import { AxiSparkContext, Plugin } from '@axisparkjs/core';
import { Injectable, Injector } from '@axisparkjs/di';
import { SCHEDULE_LOGGER } from '../di/tokens';
import { Logger } from '@axisparkjs/logger';
import { SchedulerService } from '../scheduler';
import { JobGenerator } from '../jobs/job-generator';
import { MemoryStore } from '@axisparkjs/store';
import { DEFAULT_SHUTDOWN_TIMEOUT, SchedulePluginOptions } from './schedule-plugin-options';

/**
 * A plugin for managing scheduled jobs.
 */
@Injectable()
export class SchedulePlugin extends Plugin {
    private context: AxiSparkContext;
    declare protected options?: SchedulePluginOptions;
    private scheduler: SchedulerService;

    constructor(
        private logger: Logger,
        private readonly jobGenerator: JobGenerator,
        private readonly injector: Injector
    ) {
        super();
    }

    async onRegister(context: AxiSparkContext, options?: SchedulePluginOptions): Promise<void> {
        this.context = context;
        this.options = options;
        this.logger = this.logger.child('SchedulePlugin');

        this.registerContainerBindings();
        await this.initializeScheduler();

        await this.logger.info(`Plugin registered`);
    }

    private registerContainerBindings(): void {
        this.context.container.bind({ token: SCHEDULE_LOGGER, useValue: this.logger });
    }

    private async initializeScheduler(): Promise<void> {
        const jobs = await this.jobGenerator.generate();
        jobs.forEach((job) => {
            this.logger.debug(`Registered job ${job.name} of type ${job.type} ${job.initiallyDisabled ? '(initially disabled)' : ''}`);
        });
        this.scheduler = await this.injector.get(SchedulerService);
        this.scheduler.registerJobs(jobs);
    }

    async onStart(): Promise<void> {
        // The lock store is created when the plugin starts, so a shared store can use the connections registered by other plugins.
        const lockStore = this.options?.lockStore ?? MemoryStore();
        this.scheduler.useLockStore(await lockStore('lock', this.context));
        this.scheduler.startAllJobs(true);
        await this.logger.info(`Plugin started. Scheduler is running`);
    }

    async onStop(): Promise<void> {
        // The plugin waits for the running jobs, so they end, and the locks of the `no-overlap` jobs are released, before the plugins
        // registered before it, such as the plugin of the lock store, are stopped.
        await this.scheduler.stopAllJobs({ timeout: this.options?.shutdownTimeout ?? DEFAULT_SHUTDOWN_TIMEOUT });
        await this.logger.info(`Plugin stopped`);
    }
}
