import { ProviderNotFoundError } from '@axisparkjs/di';
import { StoreContext, StoreKindNotSupportedError } from '@axisparkjs/store';
import { redisConnectionToken } from '../di';
import { RedisCacheStore } from './redis-cache-store';
import { RedisLockStore } from './redis-lock-store';
import { RedisRateLimitStore } from './redis-rate-limit-store';
import { RedisStore, RedisStoreKind } from './redis-store';
import { RedisStoreConnection } from './redis-store-connection';
import { RedisStoreConnectionNotFoundError } from './redis-store-errors';

describe('RedisStore', () => {
    const client = { isReady: true };
    let context: StoreContext & { container: { resolve: jest.Mock } };

    beforeEach(() => {
        context = { container: { resolve: jest.fn().mockResolvedValue(client) }, logger: {} } as any;
    });

    const connectionOf = (store: object): RedisStoreConnection => (store as any).connection;

    it.each([
        ['rate-limit', RedisRateLimitStore],
        ['lock', RedisLockStore],
        ['cache', RedisCacheStore]
    ] as const)('creates a Redis %s store with the client of the named connection', async (kind, type) => {
        const provider = RedisStore('MAIN') as (kind: RedisStoreKind, context: StoreContext) => Promise<object>;

        const store = await provider(kind, context);

        expect(store).toBeInstanceOf(type);
        expect(context.container.resolve).toHaveBeenCalledWith(redisConnectionToken('MAIN'));
        expect(connectionOf(store).name).toBe('MAIN');
        expect(connectionOf(store).ready()).toBe(client);
    });

    it('prefixes the keys with the prefix of the options and the kind of store', async () => {
        const store = await RedisStore('MAIN', { prefix: 'myapp:' })('lock', context);

        expect(connectionOf(store).key('job')).toBe('myapp:lock:job');
    });

    it('prefixes the keys with the kind of store without a prefix', async () => {
        const store = await RedisStore('MAIN')('rate-limit', context);

        expect(connectionOf(store).key('client')).toBe('rate-limit:client');
    });

    it('throws a clear error when the connection is not configured', async () => {
        context.container.resolve.mockRejectedValue(new ProviderNotFoundError(redisConnectionToken('MISSING')));

        await expect(RedisStore('MISSING')('cache', context)).rejects.toThrow(RedisStoreConnectionNotFoundError);
        await expect(RedisStore('MISSING')('cache', context)).rejects.toThrow(
            `RedisStore('MISSING') requires the RedisPlugin with a connection named 'MISSING'.`
        );
    });

    it('rethrows other errors raised while resolving the connection', async () => {
        const error = new Error('boom');
        context.container.resolve.mockRejectedValue(error);

        await expect(RedisStore('MAIN')('cache', context)).rejects.toBe(error);
    });

    it('throws an error for an unsupported kind without resolving the connection', async () => {
        const provider = RedisStore('MAIN') as unknown as (kind: string, context: StoreContext) => Promise<unknown>;

        await expect(provider('session', context)).rejects.toThrow(StoreKindNotSupportedError);
        await expect(provider('session', context)).rejects.toThrow(`RedisStore('MAIN') does not support 'session' stores.`);
        expect(context.container.resolve).not.toHaveBeenCalled();
    });
});
