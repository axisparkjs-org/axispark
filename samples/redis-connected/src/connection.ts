import { Logger } from '@axisparkjs/logger';
import { Timeout, Scheduler } from '@axisparkjs/schedule';
import { InjectRedisConnection, RedisConnectionManager, redisConnectionToken } from '@axisparkjs/redis';
import { Inject } from '@axisparkjs/di';
import { RedisClientType } from 'redis';
import { SessionCache } from './session-cache';

@Scheduler()
export class UsingRedisExample {
    constructor(
        private readonly logger: Logger,
        private readonly sessionCache: SessionCache,
        @InjectRedisConnection('CACHE') private readonly cache: RedisClientType,
        @Inject(redisConnectionToken('LOCKS')) private readonly locks: RedisClientType,
        @InjectRedisConnection('BROKEN') private readonly broken: RedisClientType,
        private readonly redisConnectionManager: RedisConnectionManager
    ) {}

    @Timeout(500)
    async useConnections() {
        await this.sessionCache.set('42', 'Ada');
        await this.logger.info(`Session 42 belongs to: ${await this.sessionCache.get('42')}`);
        await this.logger.info(`Redis Connection CACHE is ready: ${this.cache.isReady}`);
        await this.logger.info(`Redis Connection LOCKS is ready: ${this.locks.isReady}`);
        await this.logger.info(`Redis Connection BROKEN is ready: ${this.broken.isReady}`);
        await this.logger.info(`Redis Connection Manager has connections: ${Array.from(this.redisConnectionManager.getAllConnections().keys()).join(', ')}`);
        await this.logger.info(`Connection CACHE compared to Manager: ${this.cache === this.redisConnectionManager.getConnection('CACHE')}`);
    }
}
