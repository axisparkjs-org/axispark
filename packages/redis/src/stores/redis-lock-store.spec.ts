import { RedisLockStore } from './redis-lock-store';
import { RedisStoreConnection } from './redis-store-connection';
import { RedisStoreConnectionNotReadyError } from './redis-store-errors';

describe('RedisLockStore', () => {
    let client: { isReady: boolean; set: jest.Mock; eval: jest.Mock };
    let store: RedisLockStore;

    beforeEach(() => {
        client = { isReady: true, set: jest.fn().mockResolvedValue('OK'), eval: jest.fn() };
        store = new RedisLockStore(new RedisStoreConnection('MAIN', client as any, 'app:lock:'));
    });

    it('acquires a free lock with SET NX PX and a random token', async () => {
        const lock = await store.acquire('job', 1_500.2);

        expect(lock).toEqual(expect.objectContaining({ key: 'job', token: expect.any(String) }));
        expect(client.set).toHaveBeenCalledWith('app:lock:job', lock?.token, { condition: 'NX', expiration: { type: 'PX', value: 1_501 } });
    });

    it('does not acquire a lock held by another owner', async () => {
        client.set.mockResolvedValue(null);

        await expect(store.acquire('job', 1_000)).resolves.toBeUndefined();
    });

    it('releases the lock with a script that compares the token', async () => {
        const lock = await store.acquire('job', 1_000);
        client.eval.mockResolvedValue(1);

        await expect(lock?.release()).resolves.toBe(true);
        expect(client.eval).toHaveBeenCalledWith(expect.stringContaining(`redis.call('DEL', KEYS[1])`), {
            keys: ['app:lock:job'],
            arguments: [lock?.token]
        });
    });

    it('reports a lock that was not released because it was not owned anymore', async () => {
        const lock = await store.acquire('job', 1_000);
        client.eval.mockResolvedValue(0);

        await expect(lock?.release()).resolves.toBe(false);
    });

    it('extends the lock with a script that compares the token', async () => {
        const lock = await store.acquire('job', 1_000);
        client.eval.mockResolvedValue(1);

        await expect(lock?.extend(2_000)).resolves.toBe(true);
        expect(client.eval).toHaveBeenCalledWith(expect.stringContaining(`redis.call('PEXPIRE', KEYS[1], ARGV[2])`), {
            keys: ['app:lock:job'],
            arguments: [lock?.token, '2000']
        });
    });

    it('reports a lock that was not extended because it was not owned anymore', async () => {
        const lock = await store.acquire('job', 1_000);
        client.eval.mockResolvedValue(0);

        await expect(lock?.extend(2_000)).resolves.toBe(false);
    });

    it('rejects the operations while the connection is not ready', async () => {
        const lock = await store.acquire('job', 1_000);
        client.isReady = false;

        await expect(store.acquire('job', 1_000)).rejects.toThrow(RedisStoreConnectionNotReadyError);
        await expect(lock?.release()).rejects.toThrow(RedisStoreConnectionNotReadyError);
    });
});
