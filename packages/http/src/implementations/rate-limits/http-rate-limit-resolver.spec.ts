import { ExecutionContext, ExecutionTransport, RateLimitDefinition } from '@axisparkjs/engine';
import { HttpRateLimitResolver } from './http-rate-limit-resolver';

describe('HttpRateLimitResolver', () => {
    let now: number;
    let resolver: HttpRateLimitResolver;
    class TestController {}

    const context = (ip = '127.0.0.1', method = 'GET', path = '/items', target = TestController): ExecutionContext =>
        ({
            transport: ExecutionTransport.Http,
            target,
            propertyKey: 'handle',
            request: { ip, method, path }
        }) as unknown as ExecutionContext;

    beforeEach(() => {
        now = 10_000;
        jest.spyOn(Date, 'now').mockImplementation(() => now);
        resolver = new HttpRateLimitResolver();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('allows requests up to the limit and rejects excess requests in the sliding window', () => {
        const definition = new RateLimitDefinition(1_000, 2);
        expect(resolver.resolve(definition, context())).toEqual({ allowed: true, retryAfterMs: 0 });
        now += 200;
        expect(resolver.resolve(definition, context())).toEqual({ allowed: true, retryAfterMs: 0 });

        now += 300;
        expect(resolver.resolve(definition, context())).toEqual({ allowed: false, retryAfterMs: 500 });
    });

    it('isolates counters by client and endpoint', () => {
        const definition = new RateLimitDefinition(1_000, 1);
        expect(resolver.resolve(definition, context()).allowed).toBe(true);
        expect(resolver.resolve(definition, context('127.0.0.2')).allowed).toBe(true);
        expect(resolver.resolve(definition, context('127.0.0.1', 'POST')).allowed).toBe(true);
        expect(resolver.resolve(definition, context('127.0.0.1', 'GET', '/other')).allowed).toBe(true);
        expect(resolver.resolve(definition, context('127.0.0.1', 'GET', '/items', class AnotherController {})).allowed).toBe(true);
        expect(resolver.resolve(definition, context()).allowed).toBe(false);
    });

    it('expires requests as their timestamps leave the sliding window', () => {
        const definition = new RateLimitDefinition(1_000, 1);
        expect(resolver.resolve(definition, context()).allowed).toBe(true);
        now += 1_000;

        expect(resolver.resolve(definition, context()).allowed).toBe(true);
    });

    it('rejects a zero request limit and periodically removes expired buckets', () => {
        const cleanupDefinition = new RateLimitDefinition(10, 1);
        resolver.resolve(cleanupDefinition, context('stale-client', 'GET', '/stale'));
        for (let index = 0; index < 254; index++) resolver.resolve(cleanupDefinition, context(`client-${index}`, 'GET', '/other'));
        now += 11;
        resolver.resolve(cleanupDefinition, context('current-client', 'GET', '/current'));

        expect(resolver.resolve(new RateLimitDefinition(10, 0), context('127.0.0.1', 'GET', '/closed'))).toEqual({
            allowed: false,
            retryAfterMs: 10
        });
    });
});
