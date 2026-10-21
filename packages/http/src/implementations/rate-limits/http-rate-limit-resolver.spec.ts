import { HttpRateLimitResolver } from './http-rate-limit-resolver';

describe('HttpRateLimitResolver', () => {
    let now: number;
    let resolver: HttpRateLimitResolver;

    beforeEach(() => {
        now = 10_000;
        jest.spyOn(Date, 'now').mockImplementation(() => now);
        resolver = new HttpRateLimitResolver({
            rateLimitOptions: {
                ttl: 1_000,
                limit: 2,
                message: 'Slow down'
            }
        } as any);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('allows requests up to the limit and rejects excess requests within the sliding window', () => {
        expect(resolver.consume('127.0.0.1', 'GET:/items')).toEqual({ allowed: true, retryAfterMs: 0 });
        now += 200;
        expect(resolver.consume('127.0.0.1', 'GET:/items')).toEqual({ allowed: true, retryAfterMs: 0 });

        now += 300;
        expect(resolver.consume('127.0.0.1', 'GET:/items')).toEqual({ allowed: false, retryAfterMs: 500 });
        expect(resolver.consume('127.0.0.2', 'GET:/items').allowed).toBe(true);
        expect(resolver.consume('127.0.0.1', 'POST:/items').allowed).toBe(true);
    });

    it('expires requests as their timestamps leave the sliding window', () => {
        resolver.consume('127.0.0.1', 'GET:/items');
        now += 1_000;

        expect(resolver.consume('127.0.0.1', 'GET:/items')).toEqual({ allowed: true, retryAfterMs: 0 });
    });

    it('uses partial decorator options over the configured defaults', () => {
        resolver.consume('127.0.0.1', 'GET:/items', { limit: 1 });

        expect(resolver.consume('127.0.0.1', 'GET:/items', { limit: 1 }).allowed).toBe(false);
    });

    it('uses a configured message string or callback', () => {
        expect(resolver.getMessage(500)).toBe('Slow down');

        const callbackResolver = new HttpRateLimitResolver({
            rateLimitOptions: {
                ttl: 1_000,
                limit: 1,
                message: (time: number) => `Retry in ${time}ms`
            }
        } as any);

        expect(callbackResolver.getMessage(500)).toBe('Retry in 500ms');
    });

    it('uses built-in defaults when rate limit options are omitted', () => {
        const defaultsResolver = new HttpRateLimitResolver({} as any);

        for (let index = 0; index < 100; index++) {
            expect(defaultsResolver.consume('127.0.0.1', 'GET:/default').allowed).toBe(true);
        }

        expect(defaultsResolver.consume('127.0.0.1', 'GET:/default').allowed).toBe(false);
        expect(defaultsResolver.getMessage(1_000)).toBe('Too many requests. Please try again later.');
    });

    it('removes expired buckets periodically and rejects a zero request limit', () => {
        const cleanupResolver = new HttpRateLimitResolver({ rateLimitOptions: { ttl: 10, limit: 1 } } as any);
        cleanupResolver.consume('stale-client', 'GET:/stale');
        for (let index = 0; index < 254; index++) cleanupResolver.consume(`client-${index}`, 'GET:/other');
        now += 11;
        cleanupResolver.consume('current-client', 'GET:/current');

        const zeroLimitResolver = new HttpRateLimitResolver({ rateLimitOptions: { ttl: 10, limit: 0 } } as any);
        expect(zeroLimitResolver.consume('127.0.0.1', 'GET:/closed')).toEqual({ allowed: false, retryAfterMs: 10 });
    });
});
