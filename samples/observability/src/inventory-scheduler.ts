import { Logger } from '@axisparkjs/logger';
import { Interval, Scheduler } from '@axisparkjs/schedule';

@Scheduler()
export class InventoryScheduler {
    constructor(private readonly logger: Logger) {}

    /** Each execution is a root span `job syncInventory`, and is counted in axispark.job.executions. */
    @Interval({ value: 500, name: 'syncInventory' })
    async syncInventory() {
        await this.logger.debug('Inventory synchronized');
    }
}
