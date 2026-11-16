import { InMemoryRateLimitStore } from './in-memory-rate-limit-store';

const policy = (ttl: number, limit: number) => ({ ttl, limit });

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

    it('allows requests up to the limit in a window and rejects the excess until the window ends', () => {
        const window = policy(1_000, 2);
        expect(store.consume('key', window)).toEqual({ allowed: true, retryAfterMs: 0 });
        now += 200;
        expect(store.consume('key', window)).toEqual({ allowed: true, retryAfterMs: 0 });

        now += 300;
        // Two requests in the current window: it must end (500 ms), and then half of its requests must leave the sliding window (500 ms).
        expect(store.consume('key', window)).toEqual({ allowed: false, retryAfterMs: 1_000 });
    });

    it('weights the requests of the previous window by the part of it that is still in the sliding window', () => {
        const window = policy(1_000, 2);
        store.consume('key', window);
        store.consume('key', window);

        now = 11_250;
        // 2 * 0.75 = 1.5 estimated requests: one more would exceed the limit until 2 * (1 - elapsed / ttl) <= 1, at 11 500.
        expect(store.consume('key', window)).toEqual({ allowed: false, retryAfterMs: 250 });

        now = 11_500;
        expect(store.consume('key', window)).toEqual({ allowed: true, retryAfterMs: 0 });
        expect(store.consume('key', window)).toEqual({ allowed: false, retryAfterMs: 500 });
    });

    it('forgets the requests of windows older than the previous one', () => {
        const window = policy(1_000, 1);
        expect(store.consume('key', window).allowed).toBe(true);

        now += 2_000;
        expect(store.consume('key', window).allowed).toBe(true);
    });

    it('isolates counters by key', () => {
        const window = policy(1_000, 1);
        expect(store.consume('a', window).allowed).toBe(true);
        expect(store.consume('b', window).allowed).toBe(true);
        expect(store.consume('a', window).allowed).toBe(false);
    });

    it('starts the counters again when the window of the key changes', () => {
        expect(store.consume('key', policy(1_000, 1)).allowed).toBe(true);
        expect(store.consume('key', policy(2_000, 1)).allowed).toBe(true);
        expect(store.consume('key', policy(2_000, 1)).allowed).toBe(false);
    });

    it('rejects every request when the limit is zero and accepts every request without window', () => {
        expect(store.consume('closed', policy(10, 0))).toEqual({ allowed: false, retryAfterMs: 10 });
        expect(store.consume('closed', policy(-5, 0))).toEqual({ allowed: false, retryAfterMs: 0 });
        expect(store.consume('open', policy(0, 1))).toEqual({ allowed: true, retryAfterMs: 0 });
        expect(store.consume('open', policy(0, 1))).toEqual({ allowed: true, retryAfterMs: 0 });
        expect(store.size).toBe(0);
    });

    it('keeps constant memory per key whatever the number of requests', () => {
        const window = policy(60_000, 10_000);
        for (let index = 0; index < 5_000; index++) store.consume('busy', window);

        expect(store.size).toBe(1);
        expect((store as any).buckets.get('busy')).toEqual({ window: 0, current: 5_000, previous: 0, ttl: 60_000 });
    });

    it('removes the expired buckets every 256 checks', () => {
        const window = policy(10, 1);
        store.consume('stale-client', window);
        for (let index = 0; index < 254; index++) store.consume(`client-${index}`, window);
        expect(store.size).toBe(255);

        now += 20;
        store.consume('current-client', window);

        expect(store.size).toBe(1);
    });
});
