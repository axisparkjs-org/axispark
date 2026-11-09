import { ExecutionContext, ExecutionTransport, RateLimitDefinition } from '@axisparkjs/engine';
import { context as otelContext, trace } from '@opentelemetry/api';
import { TestTelemetry } from '../../test/otel';
import { RateLimitTelemetry } from './rate-limit-telemetry';

describe('RateLimitTelemetry', () => {
    let telemetry: TestTelemetry;
    class ProductController {}
    const context = { transport: ExecutionTransport.Http, target: ProductController, propertyKey: 'find' } as unknown as ExecutionContext;

    beforeEach(() => {
        telemetry = new TestTelemetry().register();
    });

    afterEach(async () => {
        await telemetry.shutdown();
    });

    it('counts the rejected requests and adds an event to the active span', async () => {
        const instrumentation = new RateLimitTelemetry(telemetry.meter());
        const span = telemetry.tracer().startSpan('GET /products');

        otelContext.with(trace.setSpan(otelContext.active(), span), () => {
            instrumentation.decided(context, new RateLimitDefinition(1_000, 2), { allowed: true, retryAfterMs: 0 });
            instrumentation.decided(context, new RateLimitDefinition(1_000, 2), { allowed: false, retryAfterMs: 250 });
        });
        instrumentation.decided(context, new RateLimitDefinition(1_000, 2), { allowed: false, retryAfterMs: 100 });
        span.end();

        expect(await telemetry.dataPoints('axispark.rate_limit.rejections')).toEqual([
            expect.objectContaining({ attributes: { 'axispark.transport': 'http', 'axispark.handler': 'ProductController.find' }, value: 2 })
        ]);
        expect(telemetry.finishedSpans()[0].events).toEqual([
            expect.objectContaining({ name: 'rate_limit.rejected', attributes: { limit: 2, ttl: 1_000, retry_after_ms: 250 } })
        ]);
    });
});
