import { Injectable } from '@axisparkjs/di';
import { InjectRedisConnection } from '@axisparkjs/redis';
import { RedisClientType } from 'redis';

@Injectable()
export class SessionCache {
    constructor(@InjectRedisConnection('CACHE') private readonly redis: RedisClientType) {}

    async set(id: string, value: string): Promise<void> {
        await this.redis.set(`session:${id}`, value, { expiration: { type: 'EX', value: 60 } });
    }

    async get(id: string): Promise<string | null> {
        return await this.redis.get(`session:${id}`);
    }
}
