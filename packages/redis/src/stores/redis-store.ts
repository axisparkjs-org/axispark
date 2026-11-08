import { ProviderNotFoundError } from '@axisparkjs/di';
import { StoreContext, StoreKind, StoreKindNotSupportedError, StoreProvider, StoreTypes } from '@axisparkjs/store';
import { RedisClientType } from 'redis';
import { redisConnectionToken } from '../di';
import { RedisCacheStore } from './redis-cache-store';
import { RedisLockStore } from './redis-lock-store';
import { RedisRateLimitStore } from './redis-rate-limit-store';
import { RedisStoreConnection } from './redis-store-connection';
import { RedisStoreConnectionNotFoundError } from './redis-store-errors';

/** Options of a `RedisStore`. */
export interface RedisStoreOptions {
    /**
     * The prefix of every key, such as `myapp:`. The kind of store is added after it, so the keys of the rate limit store
     * start with `myapp:rate-limit:`. Use a different prefix for each application that shares the same Redis database.
     */
    prefix?: string;
}

/** The kinds of store implemented by `RedisStore`. */
export type RedisStoreKind = 'rate-limit' | 'lock' | 'cache';

const factories: { [K in RedisStoreKind]: (connection: RedisStoreConnection) => StoreTypes[K] } = {
    'rate-limit': (connection) => new RedisRateLimitStore(connection),
    lock: (connection) => new RedisLockStore(connection),
    cache: (connection) => new RedisCacheStore(connection)
};

/**
 * Creates the provider of the stores that keep their data in a Redis connection of the `RedisPlugin`, so every instance
 * of the application connected to the same Redis shares them.
 *
 * ```ts
 * const redis = RedisStore('MAIN', { prefix: 'myapp:' });
 *
 * app.use(HttpPlugin, HttpPluginOptionsFactory.create({ rateLimit: true, rateLimitOptions: { ttl: 60_000, limit: 100, store: redis } }));
 * app.use(SchedulePlugin, SchedulePluginOptionsFactory.create({ lockStore: redis }));
 * ```
 *
 * The plugins call the provider when they start, after the `RedisPlugin` has registered its connections, so the order of the plugins does not matter.
 * The stores use the connection but never open or close it: the `RedisPlugin` manages it.
 * @param connection The name of a connection configured in the `RedisPlugin`.
 * @param options The options of the stores.
 * @returns A provider of rate limit, lock and cache stores.
 */
export function RedisStore(connection: string, options: RedisStoreOptions = {}): StoreProvider<RedisStoreKind> {
    const provider = async (kind: StoreKind, context: StoreContext) => {
        const factory = factories[kind as RedisStoreKind] as ((connection: RedisStoreConnection) => StoreTypes[RedisStoreKind]) | undefined;
        if (!factory) throw new StoreKindNotSupportedError(`RedisStore('${connection}')`, kind);

        const client = await resolveConnection(context, connection);
        return factory(new RedisStoreConnection(connection, client, `${options.prefix ?? ''}${kind}:`));
    };
    return provider as StoreProvider<RedisStoreKind>;
}

async function resolveConnection(context: StoreContext, connection: string): Promise<RedisClientType> {
    try {
        return await context.container.resolve<RedisClientType>(redisConnectionToken(connection));
    } catch (error) {
        if (error instanceof ProviderNotFoundError) throw new RedisStoreConnectionNotFoundError(connection);
        throw error;
    }
}
