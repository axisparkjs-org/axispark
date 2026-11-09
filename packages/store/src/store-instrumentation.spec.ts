import { InMemoryCacheStore } from './cache';
import { InMemoryRateLimitStore } from './rate-limit';
import { instrumentStore, registerStoreInstrumentation, StoreInstrumentation } from './store-instrumentation';

describe('instrumentStore', () => {
    let end: jest.Mock;
    let instrumentation: jest.Mocked<StoreInstrumentation>;

    beforeEach(() => {
        end = jest.fn();
        instrumentation = { start: jest.fn().mockReturnValue(end) };
    });

    afterEach(() => {
        registerStoreInstrumentation();
    });

    it('calls the store without observing it when no instrumentation is registered', async () => {
        const store = instrumentStore('cache', new InMemoryCacheStore());

        await store.set('key', 'value');

        await expect(store.get('key')).resolves.toBe('value');
    });

    it('observes the asynchronous operations', async () => {
        const store = instrumentStore('cache', new InMemoryCacheStore());
        registerStoreInstrumentation(instrumentation);

        await store.set('key', 'value');

        expect(instrumentation.start).toHaveBeenCalledWith({ kind: 'cache', operation: 'set' });
        expect(end).toHaveBeenCalledWith();
    });

    it('observes the synchronous operations and keeps the getters', () => {
        const original = new InMemoryRateLimitStore();
        const store = instrumentStore('rate-limit', original);
        registerStoreInstrumentation(instrumentation);

        expect(store.consume('key', { ttl: 1_000, limit: 1 })).toEqual({ allowed: true, retryAfterMs: 0 });
        expect((store as InMemoryRateLimitStore).size).toBe(1);
        expect(instrumentation.start).toHaveBeenCalledWith({ kind: 'rate-limit', operation: 'consume' });
        expect(end).toHaveBeenCalledTimes(1);
    });

    it('passes the errors of the rejected and the throwing operations', async () => {
        const error = new Error('down');
        const store = instrumentStore('cache', {
            get: jest.fn().mockRejectedValue(error),
            set: jest.fn().mockImplementation(() => {
                throw error;
            }),
            delete: jest.fn()
        });
        registerStoreInstrumentation(instrumentation);

        await expect(store.get('key')).rejects.toBe(error);
        expect(() => store.set('key', 1)).toThrow(error);

        expect(end).toHaveBeenNthCalledWith(1, error);
        expect(end).toHaveBeenNthCalledWith(2, error);
    });

    it('does not wrap a store twice', () => {
        const store = instrumentStore('cache', new InMemoryCacheStore());

        expect(instrumentStore('cache', store)).toBe(store);
    });
});
