import { JobDefinition, JobObserver, JobType } from '@axisparkjs/schedule';
import { context as otelContext, SpanStatusCode, trace } from '@opentelemetry/api';
import { TestTelemetry } from '../../test/otel';
import { JobTelemetry } from './job-telemetry';

describe('JobTelemetry', () => {
    let telemetry: TestTelemetry;
    const job = { name: 'nightlyReport', type: JobType.Cron } as JobDefinition;
    const scheduledAt = new Date('2026-11-09T03:00:00.000Z');

    beforeEach(() => {
        telemetry = new TestTelemetry().register();
    });

    afterEach(async () => {
        await telemetry.shutdown();
    });

    it('starts a root span for every execution, even inside another span', async () => {
        const instrumentation = new JobTelemetry(telemetry.tracer(), telemetry.meter());
        const parent = telemetry.tracer().startSpan('request');

        await otelContext.with(trace.setSpan(otelContext.active(), parent), async () => {
            const observer = instrumentation.start(job, scheduledAt) as JobObserver;
            await (observer.run ?? ((execution) => execution()))(async () => trace.getTracer('db').startSpan('query').end());
            observer.end('executed');
        });
        parent.end();

        const [query, span] = telemetry.finishedSpans();
        expect(span.name).toBe('job nightlyReport');
        expect(span.parentSpanContext).toBeUndefined();
        expect(span.spanContext().traceId).not.toBe(parent.spanContext().traceId);
        expect(query.parentSpanContext?.spanId).toBe(span.spanContext().spanId);
        expect(span.attributes).toMatchObject({
            'axispark.job.name': 'nightlyReport',
            'axispark.job.type': 'cron',
            'axispark.job.scheduled_at': '2026-11-09T03:00:00.000Z',
            outcome: 'executed'
        });
    });

    it('records the duration and counts the executions by outcome', async () => {
        const instrumentation = new JobTelemetry(telemetry.tracer(), telemetry.meter());
        instrumentation.start(job, scheduledAt).end('executed');
        instrumentation.start(job, scheduledAt).end('skipped');
        instrumentation.start(job, scheduledAt).end('skipped');

        const executions = await telemetry.dataPoints('axispark.job.executions');
        const duration = await telemetry.dataPoints('axispark.job.duration');
        expect(executions).toEqual([
            expect.objectContaining({ attributes: { 'axispark.job.name': 'nightlyReport', outcome: 'executed' }, value: 1 }),
            expect.objectContaining({ attributes: { 'axispark.job.name': 'nightlyReport', outcome: 'skipped' }, value: 2 })
        ]);
        expect(duration.map((point) => point.attributes.outcome)).toEqual(['executed', 'skipped']);
    });

    it('marks the failed executions as errors', async () => {
        const instrumentation = new JobTelemetry(telemetry.tracer(), telemetry.meter());
        instrumentation.start(job, scheduledAt).end('failed', new TypeError('boom'));
        instrumentation.start(job, scheduledAt).end('failed');

        const [withError, withoutError] = telemetry.finishedSpans();
        expect(withError.status).toEqual({ code: SpanStatusCode.ERROR, message: 'boom' });
        expect(withError.attributes['error.type']).toBe('TypeError');
        expect(withoutError.attributes['error.type']).toBe('_OTHER');
        expect((await telemetry.dataPoints('axispark.job.duration'))[0].attributes['error.type']).toBe('TypeError');
    });

    it('works without a tracer or without a meter', async () => {
        new JobTelemetry(undefined, telemetry.meter()).start(job, scheduledAt).end('executed');
        const observer = new JobTelemetry(telemetry.tracer()).start(job, scheduledAt);
        await expect((observer.run ?? ((execution) => execution()))(async () => 'done')).resolves.toBe('done');
        observer.end('executed');

        expect(telemetry.finishedSpans()).toHaveLength(1);
        expect(await telemetry.dataPoints('axispark.job.executions')).toHaveLength(1);
    });
});
