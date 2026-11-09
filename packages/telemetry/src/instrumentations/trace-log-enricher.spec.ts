import { context as otelContext, trace } from '@opentelemetry/api';
import { TestTelemetry } from '../../test/otel';
import { traceLogEnricher } from './trace-log-enricher';

describe('traceLogEnricher', () => {
    let telemetry: TestTelemetry;

    beforeEach(() => {
        telemetry = new TestTelemetry().register();
    });

    afterEach(async () => {
        await telemetry.shutdown();
    });

    it('returns the trace and the span of the active span', () => {
        const span = telemetry.tracer().startSpan('request');

        const metadata = otelContext.with(trace.setSpan(otelContext.active(), span), traceLogEnricher);

        expect(metadata).toEqual({ trace_id: span.spanContext().traceId, span_id: span.spanContext().spanId });
        span.end();
    });

    it('returns undefined without an active span or with an invalid one', () => {
        expect(traceLogEnricher()).toBeUndefined();
        expect(
            otelContext.with(trace.setSpan(otelContext.active(), trace.wrapSpanContext({ traceId: '0', spanId: '0', traceFlags: 0 })), traceLogEnricher)
        ).toBeUndefined();
    });
});
