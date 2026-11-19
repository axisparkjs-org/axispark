import { EnvSettings } from '@axisparkjs/core';
import { Logger } from '@axisparkjs/logger';
import { Interval, Scheduler } from '@axisparkjs/schedule';
import { AppSettings } from './settings';

@Scheduler()
export class ExampleScheduler {
    constructor(
        private readonly logger: Logger,
        @EnvSettings() private readonly settings: AppSettings
    ) {}

    @Interval({ value: 5000, name: 'example-job' })
    async runExampleJob() {
        await this.logger.info(this.settings.jobMessage);
    }
}
