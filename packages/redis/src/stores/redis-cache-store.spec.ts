import { RedisCacheStore } from './redis-cache-store';
import { RedisStoreConnection } from './redis-store-connection';
import { RedisStoreConnectionNotReadyError } from './redis-store-errors';

describe('RedisCacheStore', () => {
    let client: { isReady: boolean; get: jest.Mock; set: jest.Mock; del: jest.Mock };
    let store: RedisCacheStore;

    beforeEach(() => {
        client = { isReady: true, get: jest.fn(), set: jest.fn().mockResolvedValue('OK'), del: jest.fn().mockResolvedValue(1) };
        store = new RedisCacheStore(new RedisStoreConnection('MAIN', client as any, 'app:cache:'));
    });

    it('reads and parses a stored value', async () => {
        client.get.mockResolvedValue('{"id":1}');

        await expect(store.get('user')).resolves.toEqual({ id: 1 });
        expect(client.get).toHaveBeenCalledWith('app:cache:user');
    });

    it('returns undefined for a missing key', async () => {
        client.get.mockResolvedValue(null);

        await expect(store.get('user')).resolves.toBeUndefined();
    });

    it('stores a serialized value without expiration', async () => {
        await store.set('user', { id: 1 });

        expect(client.set).toHaveBeenCalledWith('app:cache:user', '{"id":1}');
    });

    it('stores a serialized value with its time to live', async () => {
        await store.set('user', 'value', 1_000);

        expect(client.set).toHaveBeenCalledWith('app:cache:user', '"value"', { expiration: { type: 'PX', value: 1_000 } });
    });

    it('deletes a value', async () => {
        await store.delete('user');

        expect(client.del).toHaveBeenCalledWith('app:cache:user');
    });

    it('rejects the operations while the connection is not ready', async () => {
        client.isReady = false;

        await expect(store.get('user')).rejects.toThrow(RedisStoreConnectionNotReadyError);
        await expect(store.set('user', 1)).rejects.toThrow(RedisStoreConnectionNotReadyError);
        await expect(store.delete('user')).rejects.toThrow(RedisStoreConnectionNotReadyError);
    });
});
