import { RedisRateLimitStore } from './redis-rate-limit-store';
import { RedisStoreConnection } from './redis-store-connection';
import { RedisStoreConnectionNotReadyError } from './redis-store-errors';

describe('RedisRateLimitStore', () => {
    let client: { isReady: boolean; eval: jest.Mock };
    let store: RedisRateLimitStore;

    beforeEach(() => {
        client = { isReady: true, eval: jest.fn() };
        store = new RedisRateLimitStore(new RedisStoreConnection('MAIN', client as any, 'app:rate-limit:'));
    });

    it('runs the sliding window script with the prefixed key, the policy and a unique member', async () => {
        client.eval.mockResolvedValue([1, 0]);

        await expect(store.consume('bucket', { ttl: 1_000.4, limit: 5 })).resolves.toEqual({ allowed: true, retryAfterMs: 0 });

        expect(client.eval).toHaveBeenCalledWith(expect.stringContaining('ZREMRANGEBYSCORE'), {
            keys: ['app:rate-limit:bucket'],
            arguments: ['1001', '5', expect.any(String)]
        });
        const [, first] = client.eval.mock.calls[0];
        await store.consume('bucket', { ttl: 1_000, limit: 5 });
        const [, second] = client.eval.mock.calls[1];
        expect(first.arguments[2]).not.toBe(second.arguments[2]);
    });

    it('returns the time until the oldest request leaves the window when the request is rejected', async () => {
        client.eval.mockResolvedValue([0, 750]);

        await expect(store.consume('bucket', { ttl: 1_000, limit: 1 })).resolves.toEqual({ allowed: false, retryAfterMs: 750 });
    });

    it('rejects the request while the connection is not ready', async () => {
        client.isReady = false;

        await expect(store.consume('bucket', { ttl: 1_000, limit: 1 })).rejects.toThrow(RedisStoreConnectionNotReadyError);
        expect(client.eval).not.toHaveBeenCalled();
    });
});
