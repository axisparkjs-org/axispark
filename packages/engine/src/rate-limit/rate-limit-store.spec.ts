import { RateLimitDefinition } from './rate-limit-definition';
import { InMemoryRateLimitStore } from './rate-limit-store';

describe('InMemoryRateLimitStore', () => {
    let now: number;
    let store: InMemoryRateLimitStore;

    beforeEach(() => {
        now = 10_000;
        jest.spyOn(Date, 'now').mockImplementation(() => now);
        store = new InMemoryRateLimitStore();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('allows requests up to the limit and rejects excess requests in the sliding window', () => {
        const definition = new RateLimitDefinition(1_000, 2);
        expect(store.consume('key', definition)).toEqual({ allowed: true, retryAfterMs: 0 });
        now += 200;
        expect(store.consume('key', definition)).toEqual({ allowed: true, retryAfterMs: 0 });

        now += 300;
        expect(store.consume('key', definition)).toEqual({ allowed: false, retryAfterMs: 500 });
    });

    it('isolates counters by key', () => {
        const definition = new RateLimitDefinition(1_000, 1);
        expect(store.consume('a', definition).allowed).toBe(true);
        expect(store.consume('b', definition).allowed).toBe(true);
        expect(store.consume('a', definition).allowed).toBe(false);
    });

    it('expires requests as their timestamps leave the sliding window', () => {
        const definition = new RateLimitDefinition(1_000, 1);
        expect(store.consume('key', definition).allowed).toBe(true);
        now += 1_000;

        expect(store.consume('key', definition).allowed).toBe(true);
    });

    it('rejects every request when the limit is zero', () => {
        expect(store.consume('closed', new RateLimitDefinition(10, 0))).toEqual({ allowed: false, retryAfterMs: 10 });
        expect(store.size).toBe(0);
    });

    it('removes the expired buckets every 256 checks', () => {
        const definition = new RateLimitDefinition(10, 1);
        store.consume('stale-client', definition);
        for (let index = 0; index < 254; index++) store.consume(`client-${index}`, definition);
        expect(store.size).toBe(255);

        now += 11;
        store.consume('current-client', definition);

        expect(store.size).toBe(1);
    });
});
