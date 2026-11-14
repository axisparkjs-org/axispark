import { InMemoryCacheStore } from './in-memory-cache-store';

describe('InMemoryCacheStore', () => {
    let now: number;
    let store: InMemoryCacheStore;

    beforeEach(() => {
        now = 10_000;
        jest.spyOn(Date, 'now').mockImplementation(() => now);
        store = new InMemoryCacheStore();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('returns undefined for a missing key', async () => {
        await expect(store.get('missing')).resolves.toBeUndefined();
    });

    it('stores and replaces values', async () => {
        await store.set('user', { id: 1 });
        await expect(store.get('user')).resolves.toEqual({ id: 1 });

        await store.set('user', { id: 2 });
        await expect(store.get('user')).resolves.toEqual({ id: 2 });
    });

    it('keeps the values without a time to live', async () => {
        await store.set('config', 'value');
        now += 1_000_000;

        await expect(store.get('config')).resolves.toBe('value');
    });

    it('expires the values when their time to live ends', async () => {
        await store.set('session', 'value', 1_000);
        now += 999;
        await expect(store.get('session')).resolves.toBe('value');

        now += 1;
        await expect(store.get('session')).resolves.toBeUndefined();
        expect(store.size).toBe(0);
    });

    it('deletes values', async () => {
        await store.set('user', 1);
        await store.delete('user');
        await store.delete('missing');

        await expect(store.get('user')).resolves.toBeUndefined();
    });

    it('removes the expired values every 256 writes', async () => {
        await store.set('stale', 'value', 10);
        for (let index = 0; index < 254; index++) await store.set(`key-${index}`, index);
        expect(store.size).toBe(255);

        now += 11;
        await store.set('current', 'value');

        expect(store.size).toBe(255);
        await expect(store.get('key-0')).resolves.toBe(0);
    });
    describe('maximum size', () => {
        it('removes the least recently written value when a new value exceeds maxEntries', async () => {
            const lru = new InMemoryCacheStore({ maxEntries: 2 });
            await lru.set('a', 1);
            await lru.set('b', 2);
            await lru.set('c', 3);

            expect(lru.size).toBe(2);
            await expect(lru.get('a')).resolves.toBeUndefined();
            await expect(lru.get('b')).resolves.toBe(2);
            await expect(lru.get('c')).resolves.toBe(3);
        });

        it('keeps the values that are read and the values that are written again', async () => {
            const lru = new InMemoryCacheStore({ maxEntries: 2 });
            await lru.set('a', 1);
            await lru.set('b', 2);
            await lru.get('a');
            await lru.set('c', 3);
            await expect(lru.get('b')).resolves.toBeUndefined();

            await lru.set('a', 10);
            await lru.set('d', 4);
            await expect(lru.get('a')).resolves.toBe(10);
            await expect(lru.get('c')).resolves.toBeUndefined();
        });

        it('keeps 10 000 values by default, at least one value, and every value with Infinity', async () => {
            const byDefault = new InMemoryCacheStore();
            for (let index = 0; index <= 10_000; index++) await byDefault.set(`key-${index}`, index);
            expect(byDefault.size).toBe(10_000);
            await expect(byDefault.get('key-0')).resolves.toBeUndefined();

            const one = new InMemoryCacheStore({ maxEntries: 0 });
            await one.set('a', 1);
            await one.set('b', 2);
            expect(one.size).toBe(1);

            const unbounded = new InMemoryCacheStore({ maxEntries: Infinity });
            for (let index = 0; index < 10_050; index++) await unbounded.set(`key-${index}`, index);
            expect(unbounded.size).toBe(10_050);
        });
    });
});
