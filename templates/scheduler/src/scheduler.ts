import { Logger } from '@axisparkjs/logger';
import { Interval, Scheduler } from '@axisparkjs/schedule';

@Scheduler()
export class ExampleScheduler {
    constructor(private readonly logger: Logger) {}

    @Interval({ value: 5000, name: 'example-job' })
    async runExampleJob() {
        await this.logger.info('Scheduled job ran');
    }
}
