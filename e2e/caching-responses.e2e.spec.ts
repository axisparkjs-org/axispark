import { AxiSparkTestFactory } from '@axisparkjs/test';
import { AxiSparkCore } from '@axisparkjs/core';
import { Logger } from '@axisparkjs/logger';
import { createApp } from '@axisparkjs/samples/caching-responses/src/app';
import { createClient, RedisClientType } from 'redis';

const mockLogger = () =>
    ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        trace: jest.fn(),
        fatal: jest.fn(),
        child: jest.fn().mockReturnThis(),
        log: jest.fn()
    }) as unknown as jest.Mocked<Logger>;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const json = async (url: string, init?: RequestInit) => {
    const response = await fetch(url, init);
    return { status: response.status, body: (await response.json()) as any };
};

describe('Caching Responses App (memory)', () => {
    let instance: AxiSparkCore;
    const logger = mockLogger();
    const url = 'http://localhost:3010/api/products';
    const calls = async (handler: string): Promise<number> => (await json(`${url}/stats/calls`)).body.calls[handler] ?? 0;

    beforeAll(async () => {
        instance = AxiSparkTestFactory.create({ app: createApp(3010), providers: [{ token: Logger, useValue: logger }] });
        await instance.init();
        await instance.run();
    });

    afterAll(async () => {
        await instance.destroy();
    });

    it('should run the handler once and return the same body and status while the result is valid', async () => {
        const before = await calls('find');

        const first = await json(`${url}/1`);
        const second = await json(`${url}/1`);

        expect(first).toEqual({ status: 200, body: { id: '1', name: 'Keyboard', price: 49, calls: before + 1 } });
        expect(second).toEqual(first);
        expect(await calls('find')).toBe(before + 1);
    });

    it('should run the handler again when the ttl expires', async () => {
        await json(`${url}/2`);
        const before = await calls('find');

        await wait(2_100);
        await json(`${url}/2`);

        expect(await calls('find')).toBe(before + 1);
    });

    it('should cache each query string separately, whatever the order of its parameters', async () => {
        const before = await calls('find');

        await json(`${url}/1?a=1&b=2`);
        await json(`${url}/1?b=2&a=1`);
        await json(`${url}/1?a=2`);

        expect(await calls('find')).toBe(before + 2);
    });

    it('should run the guards on every request, also on cache hits', async () => {
        await json(`${url}/1`);
        const { guardChecks } = (await json(`${url}/stats/calls`)).body;

        await json(`${url}/1`);
        const blocked = await fetch(`${url}/1`, { headers: { 'x-blocked': 'true' } });

        expect(blocked.status).toBe(403);
        expect((await json(`${url}/stats/calls`)).body.guardChecks).toBe(guardChecks + 3);
    });

    it('should never cache errors', async () => {
        const before = await calls('find');

        expect((await fetch(`${url}/404`)).status).toBe(404);
        expect((await fetch(`${url}/404`)).status).toBe(404);

        expect(await calls('find')).toBe(before + 2);
    });

    it('should never cache files', async () => {
        const before = await calls('manual');

        expect((await fetch(`${url}/1/manual`)).status).toBe(200);
        expect((await fetch(`${url}/1/manual`)).status).toBe(200);

        expect(await calls('manual')).toBe(before + 2);
        expect(logger.debug).toHaveBeenCalledWith('The result of ProductController.manual is not cached because it is a FileHttpResult');
    });

    it('should not cache the handlers with @NoCache()', async () => {
        const first = (await json(`${url}/stats/calls`)).body.guardChecks;
        const second = (await json(`${url}/stats/calls`)).body.guardChecks;

        expect(second).toBe(first + 1);
    });

    it('should keep one entry per value of the @CacheVary() headers', async () => {
        const before = await calls('list');

        const english = await json(url, { headers: { 'accept-language': 'en' } });
        const spanish = await json(url, { headers: { 'accept-language': 'es' } });
        const englishAgain = await json(url, { headers: { 'accept-language': 'en' } });

        expect(english.body.products).toEqual(['Keyboard', 'Mouse']);
        expect(spanish.body.products).toEqual(['Teclado', 'Ratón']);
        expect(englishAgain).toEqual(english);
        expect(await calls('list')).toBe(before + 2);
    });

    it('should not cache requests with an Authorization or Cookie header without a custom key', async () => {
        const before = await calls('find');

        await fetch(`${url}/1`, { headers: { authorization: 'Bearer alice' } });
        await fetch(`${url}/1`, { headers: { authorization: 'Bearer alice' } });
        await fetch(`${url}/1`, { headers: { cookie: 'sid=1' } });

        expect(await calls('find')).toBe(before + 3);
    });

    it('should cache per user with a custom key', async () => {
        const before = await calls('recommended');

        const alice = await json(`${url}/recommended/me`, { headers: { authorization: 'Bearer alice' } });
        const bob = await json(`${url}/recommended/me`, { headers: { authorization: 'Bearer bob' } });
        const aliceAgain = await json(`${url}/recommended/me`, { headers: { authorization: 'Bearer alice' } });

        expect(alice.body.user).toBe('Bearer alice');
        expect(bob.body.user).toBe('Bearer bob');
        expect(aliceAgain).toEqual(alice);
        expect(await calls('recommended')).toBe(before + 2);
    });

    it('should not cache POST requests and evict the entries of a handler with CacheService', async () => {
        const cached = await json(`${url}/1`);

        const changed = await json(`${url}/1/price`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ price: 59 }) });
        const fresh = await json(`${url}/1`);

        expect(changed.status).toBe(201);
        expect(fresh.body.price).toBe(59);
        expect(fresh.body.calls).toBeGreaterThan(cached.body.calls);
    });
});

describe('Caching Responses App (Redis)', () => {
    let instances: AxiSparkCore[];
    let redis: RedisClientType;
    const loggers = [mockLogger(), mockLogger()];

    beforeAll(async () => {
        redis = createClient({ url: 'redis://localhost:6379/3' }) as RedisClientType;
        await redis.connect();
        await redis.flushDb();

        instances = [3010, 3011].map((port, index) =>
            AxiSparkTestFactory.create({ app: createApp(port, 'redis'), providers: [{ token: Logger, useValue: loggers[index] }] })
        );
        for (const instance of instances) await instance.init();
        for (const instance of instances) await instance.run();
        // Wait until both Redis clients are connected.
        await wait(500);
    });

    afterAll(async () => {
        for (const instance of instances) await instance.destroy();
        await redis.flushDb();
        await redis.close();
    });

    it('should return the entry created by one instance from the other one', async () => {
        // The default key includes the host, which is the same for every instance behind a load balancer. The custom key of this route does not.
        const headers = { authorization: 'Bearer carol' };
        const first = await json('http://localhost:3010/api/products/recommended/me', { headers });
        const second = await json('http://localhost:3011/api/products/recommended/me', { headers });

        expect(second).toEqual(first);
    });

    it('should keep the entries in Redis with the prefix and the ttl', async () => {
        await json('http://localhost:3010/api/products/2');
        const keys = await redis.keys('caching-responses:cache:http:ProductController.find:*');

        expect(keys).toHaveLength(1);
        expect(await redis.pTTL(keys[0])).toBeGreaterThan(0);
        expect(await redis.pTTL(keys[0])).toBeLessThanOrEqual(2_000);
    });

    it('should evict the entries of every instance', async () => {
        const before = await json('http://localhost:3011/api/products/2');
        expect(await json('http://localhost:3011/api/products/2')).toEqual(before);

        await fetch('http://localhost:3010/api/products/2/price', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ price: 25 })
        });
        const after = await json('http://localhost:3011/api/products/2');

        expect(after.body.price).toBe(25);
        expect(after.body.calls).toBeGreaterThan(before.body.calls);
        expect(await redis.get('caching-responses:cache:gen:ProductController.find')).toBe('1');
    });
});
