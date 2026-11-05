import { Inject, Injectable } from '@axisparkjs/di';
import { JobDefinition } from '../jobs/job-definition';
import { Logger } from '@axisparkjs/logger';
import { SCHEDULE_LOGGER } from '../di';

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
        const nextExecutionTime = this.getNextExecutionTime(job);
        if (!nextExecutionTime) return;

        const delay = nextExecutionTime.getTime() - Date.now();
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
