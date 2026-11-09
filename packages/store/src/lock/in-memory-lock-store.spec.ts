import { InMemoryLockStore } from './in-memory-lock-store';

describe('InMemoryLockStore', () => {
    let now: number;
    let store: InMemoryLockStore;

    beforeEach(() => {
        now = 10_000;
        jest.spyOn(Date, 'now').mockImplementation(() => now);
        store = new InMemoryLockStore();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('acquires a free lock with a random token', async () => {
        const lock = await store.acquire('job', 1_000);
        const other = await store.acquire('other', 1_000);

        expect(lock).toEqual(expect.objectContaining({ key: 'job', token: expect.any(String) }));
        expect(other?.token).not.toBe(lock?.token);
    });

    it('does not acquire a lock held by another owner', async () => {
        await store.acquire('job', 1_000);

        await expect(store.acquire('job', 1_000)).resolves.toBeUndefined();
    });

    it('acquires a lock again when it expires', async () => {
        await store.acquire('job', 1_000);
        now += 1_000;

        await expect(store.acquire('job', 1_000)).resolves.toBeDefined();
    });

    it('releases a lock owned by the lock', async () => {
        const lock = await store.acquire('job', 1_000);

        await expect(lock?.release()).resolves.toBe(true);
        await expect(store.acquire('job', 1_000)).resolves.toBeDefined();
    });

    it('does not release a lock that expired and was acquired by another owner', async () => {
        const first = await store.acquire('job', 1_000);
        now += 1_000;
        const second = await store.acquire('job', 1_000);

        await expect(first?.release()).resolves.toBe(false);
        await expect(store.acquire('job', 1_000)).resolves.toBeUndefined();
        await expect(second?.release()).resolves.toBe(true);
    });

    it('does not release a lock twice', async () => {
        const lock = await store.acquire('job', 1_000);
        await lock?.release();

        await expect(lock?.release()).resolves.toBe(false);
    });

    it('extends a lock owned by the lock from the current time', async () => {
        const lock = await store.acquire('job', 1_000);
        now += 900;

        await expect(lock?.extend(1_000)).resolves.toBe(true);
        now += 900;
        await expect(store.acquire('job', 1_000)).resolves.toBeUndefined();
        now += 100;
        await expect(store.acquire('job', 1_000)).resolves.toBeDefined();
    });

    it('does not extend an expired lock', async () => {
        const lock = await store.acquire('job', 1_000);
        now += 1_000;

        await expect(lock?.extend(1_000)).resolves.toBe(false);
    });

    it('removes the expired locks every 256 acquisitions', async () => {
        await store.acquire('stale', 10);
        for (let index = 0; index < 254; index++) await store.acquire(`lock-${index}`, 10_000);
        expect(store.size).toBe(255);

        now += 11;
        await store.acquire('current', 10_000);

        expect(store.size).toBe(255);
        await expect(store.acquire('stale', 10)).resolves.toBeDefined();
    });
});
