import { JobDefinition } from '../jobs/job-definition';

/** How an execution of a job ended: it ran, another instance held its lock, or it threw an error. */
export type JobOutcome = 'executed' | 'skipped' | 'failed';

/** Observes one execution of a job. Returned by `JobInstrumentation.start()`. */
export interface JobObserver {
    /** Runs the execution, for example inside the context of a new root span. Without it, the execution runs as it is. */
    run?<T>(execution: () => Promise<T>): Promise<T>;
    /** Called once when the execution ends. */
    end(outcome: JobOutcome, error?: Error): void;
}

/**
 * Observes the executions of the scheduled jobs, such as `@axisparkjs/telemetry`, which creates a span and counts the executions of each job.
 * Register it with `SchedulerRunner.registerInstrumentation()`.
 */
export interface JobInstrumentation {
    /**
     * Called before an occurrence of a job runs, before the lock of an exclusive job is acquired.
     * @param job The job.
     * @param scheduledAt The scheduled time of the occurrence.
     * @returns The observer of the execution, or a function called when the execution ends.
     */
    start(job: JobDefinition, scheduledAt: Date): JobObserver | ((outcome: JobOutcome, error?: Error) => void);
}
