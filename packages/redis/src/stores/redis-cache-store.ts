import { CacheStore } from '@axisparkjs/store';
import { RedisStoreConnection, toRedisTtl } from './redis-store-connection';

/**
 * Stores the cached values in Redis, serialized with JSON, so every instance of the application connected to the same Redis shares them.
 * The values with a time to live expire in Redis (`SET PX`).
 */
export class RedisCacheStore implements CacheStore {
    constructor(private readonly connection: RedisStoreConnection) {}

    public async get<T>(key: string): Promise<T | undefined> {
        const value = await this.connection.ready().get(this.connection.key(key));
        return value === null ? undefined : (JSON.parse(value) as T);
    }

    public async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
        const serialized = JSON.stringify(value);
        const client = this.connection.ready();

        if (ttlMs === undefined) await client.set(this.connection.key(key), serialized);
        else await client.set(this.connection.key(key), serialized, { expiration: { type: 'PX', value: toRedisTtl(ttlMs) } });
    }

    public async delete(key: string): Promise<void> {
        await this.connection.ready().del(this.connection.key(key));
    }
}
