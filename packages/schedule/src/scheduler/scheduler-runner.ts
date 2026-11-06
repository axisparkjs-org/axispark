import { Inject, Injectable } from '@axisparkjs/di';
import { JobDefinition } from '../jobs/job-definition';
import { Logger } from '@axisparkjs/logger';
import { SCHEDULE_LOGGER } from '../di';

/**
 * The maximum delay accepted by Node.js timers (2^31 - 1 ms, about 24.8 days).
 * Longer delays are set to 1 ms by Node.js, so they are split into several timers.
 */
const MAX_TIMER_DELAY = 2 ** 31 - 1;

/**
 * A class for running scheduled jobs.
 */
@Injectable()
export class SchedulerRunner {
    private readonly runningJobs = new Map<string, NodeJS.Timeout>();
    private readonly enabledJobs = new Set<string>();

    constructor(@Inject(SCHEDULE_LOGGER) private readonly logger: Logger) {}

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
        const nextExecutionTime = job.getNextExecutionTime();
        if (!nextExecutionTime || nextExecutionTime.getTime() <= Date.now()) return;

        const delay = nextExecutionTime.getTime() - Date.now();
        if (delay > MAX_TIMER_DELAY) {
            // Wait for the maximum delay and calculate the remaining delay again, without running the job.
            const timeout = setTimeout(() => this.schedule(job), MAX_TIMER_DELAY);

            this.runningJobs.set(job.name, timeout);
            return;
        }

        const timeout = setTimeout(async () => {
            try {
                await job.execute();
            } catch (error) {
                this.logger.error(`Error executing job ${job.name}`, error as Error);
            } finally {
                this.runningJobs.delete(job.name);
                if (this.enabledJobs.has(job.name)) this.schedule(job);
            }
        }, delay);

        this.runningJobs.set(job.name, timeout);
    }
}
