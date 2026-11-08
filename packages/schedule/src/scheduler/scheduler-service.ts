import { Injectable } from '@axisparkjs/di';
import { LockStore } from '@axisparkjs/store';
import { SchedulerRegistry } from './scheduler-registry';
import { SchedulerRunner, SchedulerStopOptions } from './scheduler-runner';
import { JobDefinition } from '../jobs';
import { SchedulerError } from '../errors';

/**
 * A service for managing scheduled jobs.
 */
@Injectable()
export class SchedulerService {
    constructor(
        private readonly registry: SchedulerRegistry,
        private readonly runner: SchedulerRunner
    ) {}

    /**
     * Sets the store of the locks of the exclusive jobs.
     * @param store The lock store.
     */
    useLockStore(store: LockStore): void {
        this.runner.useLockStore(store);
    }

    /**
     * Registers a job with the scheduler.
     * @param job The job to register.
     */
    registerJob(job: JobDefinition): void {
        this.registry.registerJob(job);
    }

    /**
     * Registers multiple jobs with the scheduler.
     * @param jobs The jobs to register.
     */
    registerJobs(jobs: JobDefinition[]): void {
        jobs.forEach((job) => this.registerJob(job));
    }

    /**
     * Starts a job.
     * @param job The job to start.
     */
    startJob(job: string | JobDefinition): void {
        const jobInstance = this.registry.getJob(typeof job === 'string' ? job : job.name);
        if (!jobInstance && typeof job === 'string') throw new SchedulerError(`Job with name "${job}" is not registered.`);
        if (!jobInstance && job instanceof JobDefinition) this.registry.registerJob(job);

        this.runner.start(jobInstance || (job as JobDefinition));
    }

    /**
     * Starts all jobs.
     * @param onlyInitiallyEnabled If true, only starts jobs that are not initially disabled.
     */
    startAllJobs(onlyInitiallyEnabled = false): void {
        const jobs = this.registry.getAllJobs().filter((job) => !onlyInitiallyEnabled || !job.initiallyDisabled);
        this.runner.startAll(jobs);
    }

    /**
     * Stops a job: no new execution starts, the signal of its running execution is aborted, and it waits for that execution.
     * @param job The job to stop.
     * @param options The options to stop the job. Without a `timeout`, it waits until the running execution ends.
     * @returns A promise resolving when the running execution ends or the timeout ends.
     */
    async stopJob(job: string | JobDefinition, options?: SchedulerStopOptions): Promise<void> {
        const jobInstance = this.registry.getJob(typeof job === 'string' ? job : job.name);
        if (!jobInstance) return;

        await this.runner.stop(jobInstance, options);
    }

    /**
     * Stops all jobs: no new execution starts, the signal of the running executions is aborted, and it waits for them.
     * @param options The options to stop the jobs. Without a `timeout`, it waits until the running executions end.
     * @returns A promise resolving when the running executions end or the timeout ends.
     */
    async stopAllJobs(options?: SchedulerStopOptions): Promise<void> {
        const jobs = this.registry.getAllJobs();
        await this.runner.stopAll(jobs, options);
    }

    /**
     * Checks if a job is running, this is, if it is scheduled. Use `isJobExecuting()` to check if an execution is in progress.
     * @param job The job to check.
     * @returns True if the job is scheduled, false otherwise.
     */
    isJobRunning(job: string | JobDefinition): boolean {
        const jobInstance = this.registry.getJob(typeof job === 'string' ? job : job.name);
        if (!jobInstance) return false;

        return this.runner.isRunning(jobInstance);
    }

    /**
     * Checks if an execution of a job is in progress.
     * @param job The job to check.
     * @returns True if the job is executing, false otherwise.
     */
    isJobExecuting(job: string | JobDefinition): boolean {
        const jobInstance = this.registry.getJob(typeof job === 'string' ? job : job.name);
        if (!jobInstance) return false;
        return this.runner.isExecuting(jobInstance);
    }
}
