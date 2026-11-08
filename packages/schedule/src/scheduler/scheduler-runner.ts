import { Inject, Injectable } from '@axisparkjs/di';
import { Lock, LockStore } from '@axisparkjs/store';
import { JobDefinition, JobExclusivity } from '../jobs/job-definition';
import { Logger } from '@axisparkjs/logger';
import { SCHEDULE_LOGGER } from '../di';
import { SchedulerError } from '../errors';

/**
 * The maximum delay accepted by Node.js timers (2^31 - 1 ms, about 24.8 days).
 * Longer delays are set to 1 ms by Node.js, so they are split into several timers.
 */
const MAX_TIMER_DELAY = 2 ** 31 - 1;

/** The default time to live of the lock of an occurrence of a job that is not recurring (date and timeout jobs). */
const DEFAULT_OCCURRENCE_LOCK_TTL = 60_000;

/** The default time to live of the lock of a `no-overlap` job, which is extended every half of it while the job runs. */
const DEFAULT_NO_OVERLAP_LOCK_TTL = 30_000;

/**
 * A class for running scheduled jobs.
 */
@Injectable()
export class SchedulerRunner {
    private readonly runningJobs = new Map<string, NodeJS.Timeout>();
    private readonly enabledJobs = new Set<string>();
    private lockStore?: LockStore;

    constructor(@Inject(SCHEDULE_LOGGER) private readonly logger: Logger) {}

    /**
     * Sets the store of the locks of the exclusive jobs. The `SchedulePlugin` calls it when it starts, with the store created by the
     * `lockStore` provider of its options, which is `MemoryStore()` by default.
     * @param store The lock store.
     */
    useLockStore(store: LockStore): void {
        this.lockStore = store;
    }

    /**
     * Starts a job.
     * @param job The job to start.
     */
    start(job: JobDefinition): void {
        if (this.runningJobs.has(job.name)) return;
        this.enabledJobs.add(job.name);
        this.schedule(job);
    }

    /**
     * Stops a job.
     * @param job The job to stop.
     */
    stop(job: JobDefinition): void {
        this.enabledJobs.delete(job.name);

        const timeout = this.runningJobs.get(job.name);
        if (timeout) {
            clearTimeout(timeout);
        }

        this.runningJobs.delete(job.name);
    }

    /**
     * Checks if a job is running.
     * @param job The job to check.
     * @returns True if the job is running, false otherwise.
     */
    isRunning(job: JobDefinition): boolean {
        return this.runningJobs.has(job.name);
    }

    /**
     * Starts all jobs.
     * @param jobs The jobs to start.
     */
    startAll(jobs: JobDefinition[]): void {
        jobs.forEach((job) => this.start(job));
    }

    /**
     * Stops all jobs.
     * @param jobs The jobs to stop.
     */
    stopAll(jobs: JobDefinition[]): void {
        jobs.forEach((job) => this.stop(job));
    }

    private schedule(job: JobDefinition): void {
        const nextExecutionTime = this.getNextExecutionTime(job);
        if (!nextExecutionTime) return;

        const delay = nextExecutionTime.getTime() - Date.now();
        if (delay > MAX_TIMER_DELAY) {
            // Wait for the maximum delay and calculate the remaining delay again, without running the job.
            const timeout = setTimeout(() => this.schedule(job), MAX_TIMER_DELAY);

            this.runningJobs.set(job.name, timeout);
            return;
        }

        const timeout = setTimeout(async () => {
            try {
                await this.run(job, nextExecutionTime);
            } catch (error) {
                this.logger.error(`Error executing job ${job.name}`, error as Error);
            } finally {
                this.runningJobs.delete(job.name);
                if (this.enabledJobs.has(job.name)) this.schedule(job);
            }
        }, delay);

        this.runningJobs.set(job.name, timeout);
    }

    /**
     * Executes an occurrence of a job. Exclusive jobs are executed only when this instance acquires their lock.
     * @param job The job.
     * @param scheduledAt The scheduled time of the occurrence.
     */
    private async run(job: JobDefinition, scheduledAt: Date): Promise<void> {
        const exclusive = job.exclusive;
        if (!exclusive) return await job.execute();

        const lock = await this.acquire(job, exclusive, scheduledAt);
        if (!lock) {
            job.skipExecution();
            return;
        }

        if (exclusive.mode === 'once-per-occurrence') {
            // The lock is not released, so an instance whose clock is behind never runs the same occurrence again. It expires with its ttl.
            return await job.execute();
        }

        await this.executeWhileLocked(job, lock, exclusive.ttl ?? DEFAULT_NO_OVERLAP_LOCK_TTL);
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

    private async executeWhileLocked(job: JobDefinition, lock: Lock, ttl: number): Promise<void> {
        const extendLock = () =>
            lock.extend(ttl).then(
                (extended) => {
                    if (!extended) this.logger.warn(`Job ${job.name} lost its lock while running`);
                },
                (error: Error) => this.logger.error(`Job ${job.name} could not extend its lock`, error)
            );
        const heartbeat = setInterval(extendLock, Math.max(1, Math.floor(ttl / 2)));

        try {
            await job.execute();
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
