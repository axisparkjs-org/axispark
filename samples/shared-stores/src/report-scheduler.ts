import { Logger } from '@axisparkjs/logger';
import { InjectRedisConnection } from '@axisparkjs/redis';
import { Interval, Scheduler } from '@axisparkjs/schedule';
import { RedisClientType } from 'redis';

@Scheduler()
export class ReportScheduler {
    constructor(
        private readonly logger: Logger,
        @InjectRedisConnection('MAIN') private readonly redis: RedisClientType
    ) {}

    /** Runs once per second on only one of the instances, using the lock store of the `SchedulePlugin`. */
    @Interval({ value: 1000, name: 'exclusiveReport', exclusive: true })
    async exclusiveReport() {
        const executions = await this.redis.incr('shared-stores:executions:exclusive');
        await this.logger.info(`Exclusive report generated (${executions} executions in every instance)`);
    }

    /** Runs once per second on every instance. */
    @Interval({ value: 1000, name: 'localReport' })
    async localReport() {
        await this.redis.incr('shared-stores:executions:local');
    }
}
