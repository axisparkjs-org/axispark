import { AxiSparkTestFactory } from '@axisparkjs/test';
import { AxiSparkCore } from '@axisparkjs/core';
import { LogEntry, Logger, LogLevel, LogTransport } from '@axisparkjs/logger';
import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { createApp } from '@axisparkjs/samples/observability/src/app';
import { TestTelemetry } from '../packages/telemetry/test/otel';

class MemoryTransport extends LogTransport {
    readonly entries: LogEntry[] = [];

    async write(entry: LogEntry): Promise<void> {
        this.entries.push(entry);
    }
}

describe('Observability App', () => {
    // The SDK is registered before the application, as instrumentation.bootstrap.ts does, with in-memory exporters instead of OTLP.
    const telemetry = new TestTelemetry().register();
    const logs = new MemoryTransport({ minLevel: LogLevel.Debug, formatter: { format: () => '' } });
    const url = 'http://localhost:3020/api';
    let app: AxiSparkCore;

    const spans = (name: string) => telemetry.finishedSpans().filter((span) => span.name === name);
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    beforeAll(async () => {
        // The test factory replaces the log transports of the application, so the entries are captured with a logger of their own.
        app = AxiSparkTestFactory.create({ app: createApp(3020), providers: [{ token: Logger, useValue: new Logger([logs]) }] });
        await app.init();
        await app.run();
    });

    afterAll(async () => {
        await app.destroy();
        await telemetry.shutdown();
    });

    it('should create a server span with the route template, the status code and the spans of the handler', async () => {
        expect((await fetch(`${url}/orders/7`)).status).toBe(200);

        const [span] = spans('GET /api/orders/:id');
        expect(span.kind).toBe(SpanKind.SERVER);
        expect(span.attributes).toMatchObject({
            'http.request.method': 'GET',
            'http.route': '/api/orders/:id',
            'url.path': '/api/orders/7',
            'http.response.status_code': 200,
            'axispark.handler': 'OrderController.find'
        });
        const [child] = spans('load order');
        expect(child.parentSpanContext?.spanId).toBe(span.spanContext().spanId);
    });

    it('should continue the trace of the traceparent header', async () => {
        const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
        await fetch(`${url}/orders/8`, { headers: { traceparent: `00-${traceId}-00f067aa0ba902b7-01` } });

        const span = spans('GET /api/orders/:id').find((item) => item.attributes['url.path'] === '/api/orders/8');
        expect(span?.spanContext().traceId).toBe(traceId);
        expect(span?.parentSpanContext?.spanId).toBe('00f067aa0ba902b7');
    });

    it('should add the trace_id and span_id of the request to the log entries', async () => {
        await fetch(`${url}/orders/9`);

        const span = spans('GET /api/orders/:id').find((item) => item.attributes['url.path'] === '/api/orders/9');
        const entry = logs.entries.find((item) => item.message === 'Order 9 loaded');
        expect(entry?.metadata).toEqual({ trace_id: span?.spanContext().traceId, span_id: expect.any(String) });
    });

    it('should mark the 5xx responses as errors, and not the 4xx responses', async () => {
        expect((await fetch(`${url}/orders/broken/now`)).status).toBe(500);
        expect((await fetch(`${url}/orders/missing`)).status).toBe(404);

        const [broken] = spans('GET /api/orders/broken/now');
        const missing = spans('GET /api/orders/:id').find((item) => item.attributes['url.path'] === '/api/orders/missing');
        expect(broken.status.code).toBe(SpanStatusCode.ERROR);
        expect(broken.attributes['error.type']).toBe('Error');
        expect(missing?.status.code).toBe(SpanStatusCode.UNSET);
        expect(missing?.attributes['http.response.status_code']).toBe(404);
    });

    it('should record the duration of the requests with the route template, never the path', async () => {
        const points = await telemetry.dataPoints('http.server.request.duration');

        const routes = points.map((point) => point.attributes['http.route']);
        expect(routes).toContain('/api/orders/:id');
        expect(routes).not.toContain('/api/orders/7');
        expect(points.find((point) => point.attributes['http.response.status_code'] === 200)?.value.count).toBeGreaterThanOrEqual(3);
    });

    it('should count the requests rejected by the rate limits and time the store operations', async () => {
        const statuses = [];
        for (let i = 0; i < 3; i++) statuses.push((await fetch(`${url}/orders/limited/now`)).status);

        expect(statuses).toEqual([200, 200, 429]);
        expect(await telemetry.dataPoints('axispark.rate_limit.rejections')).toEqual([
            expect.objectContaining({ attributes: { 'axispark.transport': 'http', 'axispark.handler': 'OrderController.limited' }, value: 1 })
        ]);
        const operations = await telemetry.dataPoints('axispark.store.operation.duration');
        expect(operations.map((point) => point.attributes)).toContainEqual({ 'axispark.store.kind': 'rate-limit', 'axispark.store.operation': 'consume' });
    });

    it('should create a root span and count the executions of the scheduled jobs', async () => {
        await wait(1_200);

        const [job] = spans('job syncInventory');
        expect(job.parentSpanContext).toBeUndefined();
        expect(job.attributes).toMatchObject({ 'axispark.job.name': 'syncInventory', 'axispark.job.type': 'interval', outcome: 'executed' });
        const executions = await telemetry.dataPoints('axispark.job.executions');
        expect(executions[0]).toEqual(expect.objectContaining({ attributes: { 'axispark.job.name': 'syncInventory', outcome: 'executed' } }));
        expect(executions[0].value).toBeGreaterThanOrEqual(1);
    });

    it('should report the health checks as a gauge and not trace the ignored health endpoint', async () => {
        expect((await fetch(`${url}/health`)).status).toBe(200);

        const points = await telemetry.dataPoints('axispark.health.status');
        expect(points.map((point) => [point.attributes['axispark.health.check'], point.value])).toEqual(
            expect.arrayContaining([
                ['Test', 1],
                ['HttpPlugin', 1],
                ['SchedulePlugin', 1]
            ])
        );
        expect(telemetry.finishedSpans().some((span) => span.attributes['axispark.handler']?.toString().startsWith('HealthController'))).toBe(false);
    });
});
