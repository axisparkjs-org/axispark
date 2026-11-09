import { JobDefinition, JobInstrumentation, JobObserver } from '@axisparkjs/schedule';
import { Counter, context as otelContext, Histogram, Meter, ROOT_CONTEXT, SpanKind, SpanStatusCode, Tracer, trace } from '@opentelemetry/api';
import { errorType, secondsSince, TelemetryAttributes as A, TelemetryMetrics } from '../telemetry-names';

/**
 * Creates a root span and records the duration and the outcome of every execution of the scheduled jobs. The executions skipped by
 * exclusive jobs, because another instance holds their lock, are recorded with `outcome="skipped"`.
 */
export class JobTelemetry implements JobInstrumentation {
    private readonly duration?: Histogram;
    private readonly executions?: Counter;

    constructor(
        private readonly tracer?: Tracer,
        meter?: Meter
    ) {
        this.duration = meter?.createHistogram(TelemetryMetrics.JOB_DURATION, {
            description: 'The duration of the executions of the scheduled jobs.',
            unit: 's'
        });
        this.executions = meter?.createCounter(TelemetryMetrics.JOB_EXECUTIONS, { description: 'The executions of the scheduled jobs, by outcome.' });
    }

    public start(job: JobDefinition, scheduledAt: Date): JobObserver {
        const start = performance.now();
        const span = this.tracer?.startSpan(
            `job ${job.name}`,
            {
                root: true,
                kind: SpanKind.INTERNAL,
                attributes: { [A.JOB_NAME]: job.name, [A.JOB_TYPE]: job.type, 'axispark.job.scheduled_at': scheduledAt.toISOString() }
            },
            ROOT_CONTEXT
        );
        const active = span ? trace.setSpan(ROOT_CONTEXT, span) : ROOT_CONTEXT;

        return {
            run: (execution) => otelContext.with(active, execution),
            end: (outcome, error) => {
                const failure = outcome === 'failed' ? errorType(error) : undefined;
                this.duration?.record(secondsSince(start), {
                    [A.JOB_NAME]: job.name,
                    [A.JOB_TYPE]: job.type,
                    [A.OUTCOME]: outcome,
                    ...(failure ? { [A.ERROR_TYPE]: failure } : {})
                });
                this.executions?.add(1, { [A.JOB_NAME]: job.name, [A.OUTCOME]: outcome });

                if (!span) return;
                span.setAttribute(A.OUTCOME, outcome);
                if (failure) {
                    span.setAttribute(A.ERROR_TYPE, failure);
                    span.setStatus({ code: SpanStatusCode.ERROR, message: error?.message });
                    if (error) span.recordException(error);
                }
                span.end();
            }
        };
    }
}
