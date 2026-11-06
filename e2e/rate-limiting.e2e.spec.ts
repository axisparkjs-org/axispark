import { AxiSparkTestFactory } from '@axisparkjs/test';
import { AxiSparkCore } from '@axisparkjs/core';
import { HttpPlugin } from '@axisparkjs/http';
import { app as appExpress } from '@axisparkjs/samples/rate-limiting/src/app-express';
import { app as appFastify } from '@axisparkjs/samples/rate-limiting/src/app-fastify';
import { ExpressHttpAdapter } from '@axisparkjs/http-express';
import { RateLimitProcessor } from '@axisparkjs/engine';
import { FastifyHttpAdapter } from '@axisparkjs/http-fastify';

describe.each([
    { name: 'Express', app: appExpress },
    { name: 'Fastify', app: appFastify }
])('Rate Limiting App ($name)', ({ app, name }) => {
    let axiSparkCore: AxiSparkCore;

    beforeAll(async () => {
        axiSparkCore = AxiSparkTestFactory.create({ app });
        await axiSparkCore.init();
        await axiSparkCore.run();
    });

    it('should create an instance of AxiSparkCore', () => {
        expect(axiSparkCore).toBeInstanceOf(AxiSparkCore);
    });

    it('should create the app with rate limiting enabled', () => {
        const plugins = axiSparkCore.used();
        expect(plugins).toHaveLength(1);
        expect(plugins).toStrictEqual([
            {
                type: HttpPlugin,
                options: expect.objectContaining({
                    adapter: name === 'Express' ? ExpressHttpAdapter : FastifyHttpAdapter,
                    basePath: '/api',
                    plugin: HttpPlugin,
                    port: 3000,
                    trustProxy: 'loopback',
                    rateLimit: true,
                    rateLimitOptions: {
                        ttl: 10_000,
                        limit: 2,
                        message: 'Too many requests from this client'
                    }
                })
            }
        ]);
    });

    it('should apply global limits and return the configured 429 message', async () => {
        expect((await fetch('http://localhost:3000/api/rate-limit/default')).status).toBe(200);
        expect((await fetch('http://localhost:3000/api/rate-limit/default')).status).toBe(200);

        const rejected = await fetch('http://localhost:3000/api/rate-limit/default');
        expect(rejected.status).toBe(429);
        expect(rejected.headers.get('retry-after')).toBeTruthy();
        expect(await rejected.json()).toEqual({ message: 'Too many requests from this client' });
    });

    it('should apply controller limits, handler precedence, and NoRateLimit overrides', async () => {
        expect((await fetch('http://localhost:3000/api/controller-rate-limit/inherited')).status).toBe(200);
        expect((await fetch('http://localhost:3000/api/controller-rate-limit/inherited')).status).toBe(429);

        expect((await fetch('http://localhost:3000/api/controller-rate-limit/override')).status).toBe(200);
        expect((await fetch('http://localhost:3000/api/controller-rate-limit/override')).status).toBe(200);
        expect((await fetch('http://localhost:3000/api/controller-rate-limit/override')).status).toBe(429);

        for (let index = 0; index < 3; index++) {
            expect((await fetch('http://localhost:3000/api/controller-rate-limit/excluded')).status).toBe(200);
            expect((await fetch('http://localhost:3000/api/rate-limit/excluded')).status).toBe(200);
        }
    });

    it('should use partial handler options with the configured time window', async () => {
        expect((await fetch('http://localhost:3000/api/rate-limit/override')).status).toBe(200);
        expect((await fetch('http://localhost:3000/api/rate-limit/override')).status).toBe(429);
    });

    it('should apply the limit to the route whatever its parameters and query string', async () => {
        expect((await fetch('http://localhost:3000/api/rate-limit/users/1')).status).toBe(200);
        expect((await fetch('http://localhost:3000/api/rate-limit/users/2')).status).toBe(200);
        expect((await fetch('http://localhost:3000/api/rate-limit/users/3')).status).toBe(429);
        expect((await fetch('http://localhost:3000/api/rate-limit/users/1?a=1')).status).toBe(429);
        expect((await fetch('http://localhost:3000/api/rate-limit/users/4?a=2')).status).toBe(429);
    });

    it('should apply the limit per client address behind a trusted proxy', async () => {
        const fetchAs = (ip: string) => fetch('http://localhost:3000/api/rate-limit/default', { headers: { 'X-Forwarded-For': ip } });

        expect((await fetchAs('203.0.113.1')).status).toBe(200);
        expect((await fetchAs('203.0.113.1')).status).toBe(200);
        expect((await fetchAs('203.0.113.1')).status).toBe(429);

        expect((await fetchAs('203.0.113.2')).status).toBe(200);
        expect((await fetchAs('203.0.113.2')).status).toBe(200);
        expect((await fetchAs('203.0.113.2')).status).toBe(429);
    });

    afterAll(async () => {
        await axiSparkCore.destroy();
        // The buckets are kept in a static store, so each adapter starts with empty buckets.
        RateLimitProcessor.registerRateLimitStore();
    });
});
