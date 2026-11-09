import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { ExecutionContext, ExecutionObserver, ExecutionTransport } from '@axisparkjs/engine';
import { context as otelContext, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import { TestTelemetry } from '../../test/otel';
import { ExecutionTelemetry } from './execution-telemetry';

describe('ExecutionTelemetry', () => {
    let telemetry: TestTelemetry;
    let instrumentation: ExecutionTelemetry;

    class ProductController {
        find() {}
    }

    const http = (overrides: Record<string, unknown> = {}, status = 200) =>
        ({
            transport: ExecutionTransport.Http,
            target: ProductController,
            propertyKey: 'find',
            route: '/api/products/:id',
            request: { method: 'get', path: '/api/products/1', headers: {} },
            response: { statusCode: status },
            ...overrides
        }) as unknown as ExecutionContext;

    const execute = async (context: ExecutionContext, error?: Error, work: () => Promise<unknown> = async () => undefined) => {
        const observer = instrumentation.start(context) as ExecutionObserver;
        await (observer.run ?? ((execution) => execution()))(work);
        observer.end({ error });
    };

    beforeEach(() => {
        telemetry = new TestTelemetry().register();
        instrumentation = new ExecutionTelemetry({ tracer: telemetry.tracer(), meter: telemetry.meter() });
    });

    afterEach(async () => {
        await telemetry.shutdown();
    });

    it('creates a server span named with the method and the route template', async () => {
        await execute(http());

        const [span] = telemetry.finishedSpans();
        expect(span.name).toBe('GET /api/products/:id');
        expect(span.kind).toBe(SpanKind.SERVER);
        expect(span.attributes).toMatchObject({
            'axispark.transport': 'http',
            'axispark.handler': 'ProductController.find',
            'http.request.method': 'GET',
            'http.route': '/api/products/:id',
            'url.path': '/api/products/1',
            'http.response.status_code': 200
        });
        expect(span.status.code).toBe(SpanStatusCode.UNSET);
    });

    it('uses the path when the context has no route', async () => {
        await execute(http({ route: undefined }));

        expect(telemetry.finishedSpans()[0].name).toBe('GET /api/products/1');
    });

    it('continues the trace of the traceparent header', async () => {
        const traceparent = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01';

        await execute(http({ request: { method: 'GET', path: '/api/products/1', headers: { traceparent } } }));

        const [span] = telemetry.finishedSpans();
        expect(span.spanContext().traceId).toBe('0af7651916cd43dd8448eb211c80319c');
        expect(span.parentSpanContext?.spanId).toBe('b7ad6b7169203331');
    });

    it('runs the execution inside the span, so the spans of the handler are its children', async () => {
        await execute(http(), undefined, async () => {
            trace.getTracer('db').startSpan('SELECT products', undefined, otelContext.active()).end();
        });

        const [child, server] = telemetry.finishedSpans();
        expect(child.parentSpanContext?.spanId).toBe(server.spanContext().spanId);
    });

    it('does not mark the 4xx responses as errors, even when a filter handled an error', async () => {
        await execute(http({}, 404), new Error('Not found'));

        const [span] = telemetry.finishedSpans();
        expect(span.status.code).toBe(SpanStatusCode.UNSET);
        expect(span.attributes['error.type']).toBeUndefined();
    });

    it('marks the 5xx responses as errors', async () => {
        class DatabaseError extends Error {}
        await execute(http({}, 503), new DatabaseError('down'));
        await execute(http({}, 500));

        const [withError, withoutError] = telemetry.finishedSpans();
        expect(withError.status).toEqual({ code: SpanStatusCode.ERROR, message: 'down' });
        expect(withError.attributes['error.type']).toBe('DatabaseError');
        expect(withError.events[0].name).toBe('exception');
        expect(withoutError.attributes['error.type']).toBe('500');
    });

    it('marks an HTTP error without status as an error', async () => {
        await execute(http({ response: undefined }), new Error('boom'));

        expect(telemetry.finishedSpans()[0].status.code).toBe(SpanStatusCode.ERROR);
    });

    it('records the HTTP duration with the route template and the execution duration', async () => {
        await execute(http());
        await execute(http({}, 500));

        const httpPoints = await telemetry.dataPoints('http.server.request.duration');
        const executionPoints = await telemetry.dataPoints('axispark.execution.duration');
        expect(httpPoints.map((point) => point.attributes)).toEqual([
            { 'http.request.method': 'GET', 'http.route': '/api/products/:id', 'http.response.status_code': 200 },
            { 'http.request.method': 'GET', 'http.route': '/api/products/:id', 'http.response.status_code': 500, 'error.type': '500' }
        ]);
        expect(executionPoints.map((point) => point.attributes)).toEqual([
            { 'axispark.transport': 'http', 'axispark.handler': 'ProductController.find', outcome: 'success' },
            { 'axispark.transport': 'http', 'axispark.handler': 'ProductController.find', outcome: 'error', 'error.type': '500' }
        ]);
        expect(httpPoints[0].value.count).toBe(1);
    });

    it('names the WebSocket spans with the registered event, and the pattern of the regex events', async () => {
        class ChatGateway {
            send() {}
            any() {}
            connect() {}
        }
        Metadata.define(MetadataKeys.WEBSOCKET_EVENT, { event: 'chat:send' }, ChatGateway.prototype, 'send');
        Metadata.define(MetadataKeys.WEBSOCKET_EVENT, { event: /^room:.*/ }, ChatGateway.prototype, 'any');
        const ws = (propertyKey: string, event?: string) =>
            ({
                transport: ExecutionTransport.WebSocket,
                target: ChatGateway,
                propertyKey,
                message: event ? { event } : undefined
            }) as unknown as ExecutionContext;

        await execute(ws('send', 'chat:send'));
        await execute(ws('any', 'room:42'));
        await execute(ws('connect'), new Error('rejected'));

        const [send, any, connect] = telemetry.finishedSpans();
        expect([send.name, any.name, connect.name]).toEqual(['chat:send', '/^room:.*/', 'ChatGateway.connect']);
        expect(send.kind).toBe(SpanKind.CONSUMER);
        expect(any.attributes['axispark.websocket.event']).toBe('/^room:.*/');
        expect(connect.status.code).toBe(SpanStatusCode.ERROR);
    });

    it('uses the received event of a WebSocket handler without metadata', async () => {
        class Gateway {
            handle() {}
        }
        await execute({
            transport: ExecutionTransport.WebSocket,
            target: Gateway,
            propertyKey: 'handle',
            message: { event: 'ping' }
        } as unknown as ExecutionContext);

        expect(telemetry.finishedSpans()[0].name).toBe('ping');
    });

    it('names the MCP spans with the capability and the name', async () => {
        class Tools {
            weather() {}
        }
        await execute({
            transport: ExecutionTransport.Mcp,
            target: Tools,
            propertyKey: 'weather',
            request: { capability: 'tool', name: 'weather' }
        } as unknown as ExecutionContext);
        await execute({ transport: ExecutionTransport.Mcp, target: Tools, propertyKey: 'weather', request: {} } as unknown as ExecutionContext);

        const [named, unnamed] = telemetry.finishedSpans();
        expect(named.name).toBe('tool weather');
        expect(named.kind).toBe(SpanKind.SERVER);
        expect(named.attributes).toMatchObject({ 'axispark.mcp.capability': 'tool', 'axispark.mcp.name': 'weather' });
        expect(unnamed.name).toBe('Tools.weather');
    });

    it('names the spans of other transports with the handler', async () => {
        await execute({ transport: ExecutionTransport.Other, target: ProductController, propertyKey: 'find' } as unknown as ExecutionContext);

        expect(telemetry.finishedSpans()[0].name).toBe('ProductController.find');
    });

    it('ignores the handlers excluded by the options', async () => {
        instrumentation = new ExecutionTelemetry({ tracer: telemetry.tracer(), meter: telemetry.meter(), ignore: () => true });

        const end = instrumentation.start(http());
        (end as (outcome: object) => void)({});

        expect(telemetry.finishedSpans()).toHaveLength(0);
    });

    it('records only the metrics without a tracer, and only the spans without a meter', async () => {
        instrumentation = new ExecutionTelemetry({ meter: telemetry.meter() });
        await execute(http());
        instrumentation = new ExecutionTelemetry({ tracer: telemetry.tracer() });
        await execute(http());

        expect(telemetry.finishedSpans()).toHaveLength(1);
        expect(await telemetry.dataPoints('axispark.execution.duration')).toHaveLength(1);
    });
});
