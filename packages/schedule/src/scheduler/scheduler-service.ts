import { Injectable } from '@axisparkjs/di';
import { LockStore } from '@axisparkjs/store';
import { SchedulerRegistry } from './scheduler-registry';
import { SchedulerRunner } from './scheduler-runner';
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
     * Stops a job.
     * @param job The job to stop.
     */
    stopJob(job: string | JobDefinition): void {
        const jobInstance = this.registry.getJob(typeof job === 'string' ? job : job.name);
        if (!jobInstance) return;

        this.runner.stop(jobInstance);
    }

    /**
     * Stops all jobs.
     */
    stopAllJobs(): void {
        const jobs = this.registry.getAllJobs();
        this.runner.stopAll(jobs);
    }

    /**
     * Checks if a job is running.
     * @param job The job to check.
     * @returns True if the job is running, false otherwise.
     */
    isJobRunning(job: string | JobDefinition): boolean {
        const jobInstance = this.registry.getJob(typeof job === 'string' ? job : job.name);
        if (!jobInstance) return false;

        return this.runner.isRunning(jobInstance);
    }
}
