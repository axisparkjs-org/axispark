import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { ExecutionContext, ExecutionInstrumentation, ExecutionObserver, ExecutionOutcome, ExecutionTransport } from '@axisparkjs/engine';
import {
    Attributes,
    context as otelContext,
    Context,
    Histogram,
    Meter,
    propagation,
    Span,
    SpanKind,
    SpanStatusCode,
    TextMapGetter,
    Tracer,
    trace
} from '@opentelemetry/api';
import { errorType, secondsSince, TelemetryAttributes as A, TelemetryMetrics } from '../telemetry-names';

/** The fields of the HTTP context read by the instrumentation, without depending on `@axisparkjs/http`. */
interface HttpLikeContext extends ExecutionContext {
    request: { method: string; path: string; headers: Readonly<Record<string, string | string[] | undefined>> };
    response?: { statusCode?: number };
    route?: string;
}

/** The fields of the WebSocket and MCP contexts read by the instrumentation. */
interface MessageLikeContext extends ExecutionContext {
    message?: { event: string };
    request?: { capability?: string; name?: string };
}

const headersGetter: TextMapGetter<Readonly<Record<string, string | string[] | undefined>>> = {
    keys: (carrier) => Object.keys(carrier ?? {}),
    get: (carrier, key) => carrier?.[key.toLowerCase()]
};

/** The options of the execution instrumentation. */
export interface ExecutionTelemetryOptions {
    tracer?: Tracer;
    meter?: Meter;
    ignore?: (context: ExecutionContext) => boolean;
}

/**
 * Creates a span and records the duration of every execution of the `ExecutionEngine`: the HTTP requests, the WebSocket events and the MCP requests.
 * The HTTP spans continue the trace of the `traceparent` header of the request, and their route is the template of the route, never the requested path.
 */
export class ExecutionTelemetry implements ExecutionInstrumentation {
    private readonly executionDuration?: Histogram;
    private readonly httpDuration?: Histogram;

    constructor(private readonly options: ExecutionTelemetryOptions) {
        this.executionDuration = options.meter?.createHistogram(TelemetryMetrics.EXECUTION_DURATION, {
            description: 'The duration of the executions of the handlers of every transport.',
            unit: 's'
        });
        this.httpDuration = options.meter?.createHistogram(TelemetryMetrics.HTTP_SERVER_REQUEST_DURATION, {
            description: 'The duration of the HTTP server requests.',
            unit: 's'
        });
    }

    public start(context: ExecutionContext): ExecutionObserver | ((outcome: ExecutionOutcome) => void) {
        if (this.options.ignore?.(context)) return () => undefined;

        const start = performance.now();
        const handler = `${context.target.name}.${String(context.propertyKey)}`;
        const isHttp = context.transport === ExecutionTransport.Http && 'request' in context;
        const http = context as HttpLikeContext;
        const method = isHttp ? http.request.method.toUpperCase() : undefined;
        const route = isHttp ? (http.route ?? http.request.path) : undefined;

        const attributes: Attributes = { [A.TRANSPORT]: context.transport, [A.HANDLER]: handler };
        let name: string;
        let kind: SpanKind;
        let parent: Context = otelContext.active();
        if (isHttp) {
            name = `${method} ${route}`;
            kind = SpanKind.SERVER;
            Object.assign(attributes, { [A.HTTP_REQUEST_METHOD]: method, [A.HTTP_ROUTE]: route, [A.URL_PATH]: http.request.path });
            parent = propagation.extract(parent, http.request.headers, headersGetter);
        } else {
            name = this.getMessageName(context as MessageLikeContext, attributes) ?? handler;
            kind = context.transport === ExecutionTransport.Mcp ? SpanKind.SERVER : SpanKind.CONSUMER;
        }

        const span: Span | undefined = this.options.tracer?.startSpan(name, { kind, attributes }, parent);
        const active = span ? trace.setSpan(parent, span) : parent;

        return {
            run: (execution) => otelContext.with(active, execution),
            end: ({ error }) => {
                const duration = secondsSince(start);
                const status = isHttp ? http.response?.statusCode : undefined;
                const failed = isHttp ? (status !== undefined && status >= 500) || (error !== undefined && status === undefined) : error !== undefined;
                const failure = failed ? (error ? errorType(error) : String(status)) : undefined;

                this.executionDuration?.record(duration, {
                    [A.TRANSPORT]: context.transport,
                    [A.HANDLER]: handler,
                    [A.OUTCOME]: failed ? 'error' : 'success',
                    ...(failure ? { [A.ERROR_TYPE]: failure } : {})
                });
                if (isHttp) {
                    this.httpDuration?.record(duration, {
                        [A.HTTP_REQUEST_METHOD]: method,
                        [A.HTTP_ROUTE]: route,
                        ...(status !== undefined ? { [A.HTTP_RESPONSE_STATUS_CODE]: status } : {}),
                        ...(failure ? { [A.ERROR_TYPE]: failure } : {})
                    });
                }

                if (!span) return;
                if (status !== undefined) span.setAttribute(A.HTTP_RESPONSE_STATUS_CODE, status);
                if (failure) {
                    span.setAttribute(A.ERROR_TYPE, failure);
                    span.setStatus({ code: SpanStatusCode.ERROR, message: error?.message });
                    if (error) span.recordException(error);
                }
                span.end();
            }
        };
    }

    /** The name of the span of a WebSocket event or an MCP request, with the registered event, never the received one for regex events. */
    private getMessageName(context: MessageLikeContext, attributes: Attributes): string | undefined {
        if (context.transport === ExecutionTransport.WebSocket) {
            const metadata = Metadata.get<{ event: string | RegExp }>(MetadataKeys.WEBSOCKET_EVENT, context.target, context.propertyKey);
            const event = metadata ? String(metadata.event) : context.message?.event;
            if (event === undefined) return undefined;
            attributes[A.WEBSOCKET_EVENT] = event;
            return event;
        }

        if (context.transport === ExecutionTransport.Mcp && context.request?.name) {
            attributes[A.MCP_CAPABILITY] = context.request.capability;
            attributes[A.MCP_NAME] = context.request.name;
            return `${context.request.capability} ${context.request.name}`;
        }

        return undefined;
    }
}
