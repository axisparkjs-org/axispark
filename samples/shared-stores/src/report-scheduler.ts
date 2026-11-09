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

    /**
     * Runs on only one instance at a time, for about 2 seconds. When the application stops, the scheduler aborts the signal and waits for
     * the job, which ends after its current step, so its lock is released in Redis before the Redis connection is closed.
     */
    @Interval({ value: 1000, name: 'noOverlapReport', exclusive: { mode: 'no-overlap' } })
    async noOverlapReport(signal: AbortSignal) {
        await this.redis.incr('shared-stores:executions:no-overlap:started');
        for (let step = 0; step < 20; step++) {
            if (signal.aborted) {
                await this.redis.incr('shared-stores:executions:no-overlap:aborted');
                return;
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        await this.redis.incr('shared-stores:executions:no-overlap:finished');
    }

    /** Runs once per second on every instance. */
    @Interval({ value: 1000, name: 'localReport' })
    async localReport() {
        await this.redis.incr('shared-stores:executions:local');
    }
}
