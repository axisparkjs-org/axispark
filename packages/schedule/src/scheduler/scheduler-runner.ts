import { AsyncLocalStorage } from 'node:async_hooks';
import { Inject, Injectable } from '@axisparkjs/di';
import { instrumentStore, Lock, LockStore } from '@axisparkjs/store';
import { JobDefinition, JobExclusivity } from '../jobs/job-definition';
import { Logger } from '@axisparkjs/logger';
import { SCHEDULE_LOGGER } from '../di';
import { SchedulerError } from '../errors';
import { JobInstrumentation, JobObserver, JobOutcome } from './job-instrumentation';

/**
 * The maximum delay accepted by Node.js timers (2^31 - 1 ms, about 24.8 days).
 * Longer delays are set to 1 ms by Node.js, so they are split into several timers.
 */
const MAX_TIMER_DELAY = 2 ** 31 - 1;

/** The default time to live of the lock of an occurrence of a job that is not recurring (date and timeout jobs). */
const DEFAULT_OCCURRENCE_LOCK_TTL = 60_000;

/** The default time to live of the lock of a `no-overlap` job, which is extended every half of it while the job runs. */
const DEFAULT_NO_OVERLAP_LOCK_TTL = 30_000;

/** Options for stopping jobs. */
export interface SchedulerStopOptions {
    /**
     * The maximum time to wait for the running executions, in milliseconds. `0` does not wait, and `undefined` waits until they end.
     */
    timeout?: number;
}

/** An execution of a job in progress. */
interface RunningExecution {
    promise: Promise<void>;
    /** Aborted when the job is stopped, so the job can end early. */
    readonly controller: AbortController;
    /** The timer that extends the lock of a `no-overlap` job while it runs. */
    heartbeat?: NodeJS.Timeout;
}

/**
 * A class for running scheduled jobs.
 */
@Injectable()
export class SchedulerRunner {
    private static instrumentation?: JobInstrumentation;
    /** The pending timer of each scheduled job. */
    private readonly timers = new Map<string, NodeJS.Timeout>();
    /** The execution in progress of each job. */
    private readonly executions = new Map<string, RunningExecution>();
    private readonly enabledJobs = new Set<string>();
    /** The execution in which the current code runs, so a job that stops itself does not wait for its own execution. */
    private readonly currentExecution = new AsyncLocalStorage<RunningExecution>();
    private lockStore?: LockStore;

    constructor(@Inject(SCHEDULE_LOGGER) private readonly logger: Logger) {}

    /**
     * Registers the instrumentation that observes the executions of every job, such as the one of `@axisparkjs/telemetry`.
     * Passing undefined removes it.
     */
    static registerInstrumentation(instrumentation?: JobInstrumentation): void {
        this.instrumentation = instrumentation;
    }

    /**
     * Sets the store of the locks of the exclusive jobs. The `SchedulePlugin` calls it when it starts, with the store created by the
     * `lockStore` provider of its options, which is `MemoryStore()` by default.
     * @param store The lock store.
     */
    useLockStore(store: LockStore): void {
        this.lockStore = instrumentStore('lock', store);
    }

    /**
     * Starts a job.
     * @param job The job to start.
     */
    start(job: JobDefinition): void {
        if (this.timers.has(job.name)) return;
        this.enabledJobs.add(job.name);
        this.schedule(job);
    }

    /**
     * Stops a job: no new execution starts, the signal of its running execution is aborted, and it waits for that execution.
     * @param job The job to stop.
     * @param options The options to stop the job, such as the maximum time to wait for its running execution.
     * @returns A promise resolving when the running execution ends or the timeout ends.
     */
    async stop(job: JobDefinition, options?: SchedulerStopOptions): Promise<void> {
        await this.stopAll([job], options);
    }

    /**
     * Checks if a job is running, this is, if it is scheduled. Use `isExecuting()` to check if an execution is in progress.
     * @param job The job to check.
     * @returns True if the job is scheduled, false otherwise.
     */
    isRunning(job: JobDefinition): boolean {
        return this.timers.has(job.name);
    }

    /**
     * Checks if an execution of a job is in progress.
     * @param job The job to check.
     * @returns True if the job is executing, false otherwise.
     */
    isExecuting(job: JobDefinition): boolean {
        return this.executions.has(job.name);
    }

    /**
     * Starts all jobs.
     * @param jobs The jobs to start.
     */
    startAll(jobs: JobDefinition[]): void {
        jobs.forEach((job) => this.start(job));
    }

    /**
     * Stops scheduling the jobs and waits for their running executions, up to the timeout.
     * The timers are cancelled and the jobs disabled first, so no new execution starts, and the signal of every running execution is
     * aborted. When the timeout ends first, a warning with the names of the jobs that are still running is logged, and the heartbeat of
     * their locks is stopped, so the locks of the `no-overlap` jobs expire with their ttl once the process exits.
     * @param jobs The jobs to stop.
     * @param options The options to stop the jobs, such as the maximum time to wait for the running executions.
     * @returns A promise resolving when the running executions end or the timeout ends.
     */
    async stopAll(jobs: JobDefinition[], options: SchedulerStopOptions = {}): Promise<void> {
        const running: [string, RunningExecution][] = [];
        const current = this.currentExecution.getStore();
        for (const job of jobs) {
            const execution = this.cancel(job);
            // A job that stops itself would wait for its own execution forever.
            if (execution && execution !== current) running.push([job.name, execution]);
        }
        if (running.length === 0) return;

        const finished = await this.waitFor(
            running.map(([, execution]) => execution.promise),
            options.timeout
        );
        if (finished) return;

        const pending = running.filter(([name, execution]) => this.executions.get(name) === execution);
        if (pending.length === 0) return;
        pending.forEach(([, execution]) => clearInterval(execution.heartbeat));
        this.logger.warn(`Stopped the scheduler without waiting for the running jobs after ${options.timeout}ms: ${pending.map(([name]) => name).join(', ')}`);
    }

    /**
     * Cancels the timer of a job, disables it and aborts the signal of its running execution.
     * @param job The job.
     * @returns The running execution of the job, if any.
     */
    private cancel(job: JobDefinition): RunningExecution | undefined {
        this.enabledJobs.delete(job.name);
        const timer = this.timers.get(job.name);
        if (timer) clearTimeout(timer);
        this.timers.delete(job.name);

        const execution = this.executions.get(job.name);
        execution?.controller.abort();
        return execution;
    }

    /**
     * Waits for the executions, up to the timeout.
     * @returns True if every execution ended, false if the timeout ended first.
     */
    private async waitFor(executions: Promise<void>[], timeout?: number): Promise<boolean> {
        const settled = Promise.allSettled(executions).then(() => true);
        if (timeout === undefined) return await settled;
        if (timeout <= 0) return false;

        let timer: NodeJS.Timeout | undefined;
        const expired = new Promise<boolean>((resolve) => {
            timer = setTimeout(() => resolve(false), timeout);
        });
        try {
            return await Promise.race([settled, expired]);
        } finally {
            clearTimeout(timer);
        }
    }

    private schedule(job: JobDefinition): void {
        const nextExecutionTime = this.getNextExecutionTime(job);
        if (!nextExecutionTime) return;

        const delay = nextExecutionTime.getTime() - Date.now();
        if (delay > MAX_TIMER_DELAY) {
            // Wait for the maximum delay and calculate the remaining delay again, without running the job.
            const timer = setTimeout(() => this.schedule(job), MAX_TIMER_DELAY);
            this.timers.set(job.name, timer);
            return;
        }

        const timer = setTimeout(() => {
            const execution: RunningExecution = { promise: Promise.resolve(), controller: new AbortController() };
            this.executions.set(job.name, execution);
            execution.promise = this.currentExecution.run(execution, () => this.execute(job, nextExecutionTime, execution, timer));
        }, delay);
        this.timers.set(job.name, timer);
    }

    /**
     * Executes an occurrence of a job, logs its errors and schedules the next occurrence while the job is enabled.
     */
    private async execute(job: JobDefinition, scheduledAt: Date, execution: RunningExecution, timer: NodeJS.Timeout): Promise<void> {
        const observer = this.observe(job, scheduledAt);
        let outcome: JobOutcome = 'executed';
        let failure: Error | undefined;
        try {
            const run = () => this.run(job, scheduledAt, execution);
            const executed = await (observer?.run ? observer.run(run) : run());
            if (!executed) outcome = 'skipped';
        } catch (error) {
            outcome = 'failed';
            failure = error as Error;
            this.logger.error(`Error executing job ${job.name}`, error as Error);
        } finally {
            observer?.end(outcome, failure);
            if (this.executions.get(job.name) === execution) this.executions.delete(job.name);
            // The job may have been stopped, or stopped and started again, while it was executing.
            if (this.timers.get(job.name) === timer) {
                this.timers.delete(job.name);
                if (this.enabledJobs.has(job.name)) this.schedule(job);
            }
        }
    }

    /**
     * Executes an occurrence of a job. Exclusive jobs are executed only when this instance acquires their lock.
     * @param job The job.
     * @param scheduledAt The scheduled time of the occurrence.
     * @param execution The execution in progress.
     * @returns True when the job was executed, false when it was skipped because this instance did not acquire its lock.
     */
    private async run(job: JobDefinition, scheduledAt: Date, execution: RunningExecution): Promise<boolean> {
        const signal = execution.controller.signal;
        const exclusive = job.exclusive;
        if (!exclusive) {
            await job.execute(signal);
            return true;
        }

        const lock = await this.acquire(job, exclusive, scheduledAt);
        if (!lock) {
            job.skipExecution();
            return false;
        }

        if (exclusive.mode === 'once-per-occurrence') {
            // The lock is not released, so an instance whose clock is behind never runs the same occurrence again. It expires with its ttl.
            await job.execute(signal);
            return true;
        }

        await this.executeWhileLocked(job, lock, exclusive.ttl ?? DEFAULT_NO_OVERLAP_LOCK_TTL, execution);
        return true;
    }

    /** Starts the observation of an execution with the registered instrumentation, if any. */
    private observe(job: JobDefinition, scheduledAt: Date): JobObserver | undefined {
        const started = SchedulerRunner.instrumentation?.start(job, scheduledAt);
        return typeof started === 'function' ? { end: started } : started;
    }

    private async acquire(job: JobDefinition, exclusive: JobExclusivity, scheduledAt: Date): Promise<Lock | undefined> {
        if (!this.lockStore) throw new SchedulerError(`Job ${job.name} is exclusive, but no lock store is registered.`);

        const [key, ttl] =
            exclusive.mode === 'once-per-occurrence'
                ? [
                      `schedule:${job.name}:${job.getOccurrenceKey(scheduledAt)}`,
                      exclusive.ttl ?? job.getOccurrenceInterval(scheduledAt) ?? DEFAULT_OCCURRENCE_LOCK_TTL
                  ]
                : [`schedule:${job.name}`, exclusive.ttl ?? DEFAULT_NO_OVERLAP_LOCK_TTL];

        let lock: Lock | undefined;
        try {
            lock = await this.lockStore.acquire(key, ttl);
        } catch (error) {
            this.logger.error(`Job ${job.name} skipped because its lock could not be acquired`, error as Error);
            return undefined;
        }

        if (!lock) this.logger.debug(`Job ${job.name} skipped because another instance holds its lock`);
        return lock;
    }

    private async executeWhileLocked(job: JobDefinition, lock: Lock, ttl: number, execution: RunningExecution): Promise<void> {
        const extendLock = () =>
            lock.extend(ttl).then(
                (extended) => {
                    if (!extended) this.logger.warn(`Job ${job.name} lost its lock while running`);
                },
                (error: Error) => this.logger.error(`Job ${job.name} could not extend its lock`, error)
            );
        const heartbeat = setInterval(extendLock, Math.max(1, Math.floor(ttl / 2)));
        // The shutdown stops the heartbeat of a job that exceeds its timeout, so its lock expires with its ttl once the process exits.
        execution.heartbeat = heartbeat;

        try {
            await job.execute(execution.controller.signal);
        } finally {
            clearInterval(heartbeat);
            await lock.release().catch((error: Error) => this.logger.error(`Job ${job.name} could not release its lock`, error));
        }
    }

    /**
     * Gets the next execution time of a job. When it is already in the past, for example because the previous execution
     * took longer than the time to the next one, the missed executions are skipped and the next one is calculated from now.
     * @param job The job.
     * @returns The next execution time, or undefined if the job has no more executions.
     */
    private getNextExecutionTime(job: JobDefinition): Date | undefined {
        const nextExecutionTime = job.getNextExecutionTime();
        if (!nextExecutionTime || nextExecutionTime.getTime() > Date.now()) return nextExecutionTime;

        const rescheduledExecutionTime = job.getNextExecutionTimeAfter(new Date());
        if (rescheduledExecutionTime) {
            this.logger.warn(
                `Job ${job.name} skipped the executions missed since ${nextExecutionTime.toISOString()}. Next execution at ${rescheduledExecutionTime.toISOString()}`
            );
        }

        return rescheduledExecutionTime;
    }
}
