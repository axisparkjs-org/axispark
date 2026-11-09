import { CacheDefinition, ExecutionContext, ExecutionTransport } from '@axisparkjs/engine';
import { CacheVary } from '../../decorators/cache-vary';
import { HttpCacheResolver } from './http-cache-resolver';

describe('HttpCacheResolver', () => {
    const resolver = new HttpCacheResolver();
    const definition = new CacheDefinition(1_000);

    class ProductController {
        find() {}
        @CacheVary('Accept-Language')
        localized() {}
    }

    @CacheVary('X-Tenant')
    class TenantController {
        find() {}
        @CacheVary('Accept')
        accept() {}
    }

    const context = (request: Record<string, unknown> = {}, target: object = ProductController, propertyKey = 'find'): ExecutionContext =>
        ({
            transport: ExecutionTransport.Http,
            target,
            propertyKey,
            request: { method: 'GET', path: '/products/1', query: {}, headers: { host: 'shop.test' }, ...request }
        }) as unknown as ExecutionContext;

    it('builds the key with the method, the host, the path and the query', async () => {
        await expect(resolver.resolve(context({ query: { page: '2' } }), definition)).resolves.toBe(
            JSON.stringify(['GET', 'shop.test', '/products/1', [['page', '2']]])
        );
    });

    it('builds the same key whatever the order of the query parameters', async () => {
        const first = await resolver.resolve(context({ query: { b: '1', a: ['2', '3'], c: '0' } }), definition);
        const second = await resolver.resolve(context({ query: { c: '0', a: ['2', '3'], b: '1' } }), definition);

        expect(first).toBe(second);
        expect(first).toBe(
            JSON.stringify([
                'GET',
                'shop.test',
                '/products/1',
                [
                    ['a', ['2', '3']],
                    ['b', '1'],
                    ['c', '0']
                ]
            ])
        );
    });

    it('builds different keys for different hosts, paths, queries and methods', async () => {
        const keys = await Promise.all([
            resolver.resolve(context(), definition),
            resolver.resolve(context({ headers: { host: 'other.test' } }), definition),
            resolver.resolve(context({ path: '/products/2' }), definition),
            resolver.resolve(context({ query: { page: '1' } }), definition),
            resolver.resolve(context({ method: 'head' }), definition)
        ]);

        expect(new Set(keys).size).toBe(5);
    });

    it('caches the requests without host or query', async () => {
        await expect(resolver.resolve(context({ headers: {}, query: undefined }), definition)).resolves.toBe(JSON.stringify(['GET', '', '/products/1', []]));
    });

    it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])('does not cache %s requests, even with a custom key', async (method) => {
        await expect(resolver.resolve(context({ method }), definition)).resolves.toBeUndefined();
        await expect(resolver.resolve(context({ method }), new CacheDefinition(1_000, () => 'key'))).resolves.toBeUndefined();
    });

    it.each([
        ['authorization', 'Bearer token'],
        ['cookie', 'sid=1'],
        ['cookie', ['sid=1']]
    ])('does not cache the requests with a %s header', async (header, value) => {
        await expect(resolver.resolve(context({ headers: { host: 'shop.test', [header]: value } }), definition)).resolves.toBeUndefined();
    });

    it('caches the requests with empty private headers', async () => {
        await expect(resolver.resolve(context({ headers: { authorization: '', cookie: [] } }), definition)).resolves.toBeDefined();
    });

    it('uses the custom key of the definition, which enables the cache of the requests with private headers', async () => {
        const key = jest.fn().mockReturnValue('user-1');
        const ctx = context({ headers: { authorization: 'Bearer token' } });

        await expect(resolver.resolve(ctx, new CacheDefinition(1_000, key))).resolves.toBe('user-1');
        expect(key).toHaveBeenCalledWith(ctx);
    });

    it('does not cache when the custom key returns undefined', async () => {
        await expect(resolver.resolve(context(), new CacheDefinition(1_000, () => undefined))).resolves.toBeUndefined();
    });

    it('adds the headers of @CacheVary() of the method to the key', async () => {
        const es = await resolver.resolve(context({ headers: { 'accept-language': 'es' } }, ProductController, 'localized'), definition);
        const en = await resolver.resolve(context({ headers: { 'accept-language': 'en' } }, ProductController, 'localized'), definition);
        const none = await resolver.resolve(context({ headers: {} }, ProductController, 'localized'), definition);

        expect(es).toBe(`${JSON.stringify(['GET', '', '/products/1', []])}:${JSON.stringify([['accept-language', 'es']])}`);
        expect(new Set([es, en, none]).size).toBe(3);
    });

    it('adds the headers of @CacheVary() to a custom key', async () => {
        await expect(
            resolver.resolve(
                context({ headers: { 'accept-language': ['es', 'en'] } }, ProductController, 'localized'),
                new CacheDefinition(1_000, () => 'user-1')
            )
        ).resolves.toBe(`user-1:${JSON.stringify([['accept-language', 'es, en']])}`);
    });

    it('uses the @CacheVary() of the class, replaced by the one of the method', async () => {
        const headers = { 'x-tenant': 'acme', accept: 'text/csv' };

        await expect(resolver.resolve(context({ headers }, TenantController, 'find'), definition)).resolves.toMatch(/:\[\["x-tenant","acme"\]\]$/);
        await expect(resolver.resolve(context({ headers }, TenantController, 'accept'), definition)).resolves.toMatch(/:\[\["accept","text\/csv"\]\]$/);
    });
});
