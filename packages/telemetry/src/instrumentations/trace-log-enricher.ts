import { LogEnricher } from '@axisparkjs/logger';
import { isSpanContextValid, trace } from '@opentelemetry/api';

/** Adds the `trace_id` and `span_id` of the active span to every log entry. */
export const traceLogEnricher: LogEnricher = () => {
    const spanContext = trace.getActiveSpan()?.spanContext();
    if (!spanContext || !isSpanContextValid(spanContext)) return undefined;

    return { trace_id: spanContext.traceId, span_id: spanContext.spanId };
};
