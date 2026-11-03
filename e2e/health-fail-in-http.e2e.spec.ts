import { AxiSparkTestFactory } from '@axisparkjs/test';
import { AxiSparkCore } from '@axisparkjs/core';
import { HttpPlugin } from '@axisparkjs/http';
import { BadPlugin } from '@axisparkjs/samples/health-fail-in-http/src/plugin';
import { app as appExpress } from '@axisparkjs/samples/health-fail-in-http/src/app-express';
import { app as appFasitfy } from '@axisparkjs/samples/health-fail-in-http/src/app-fastify';
import { ExpressHttpAdapter } from '@axisparkjs/http-express';
import { FastifyHttpAdapter } from '@axisparkjs/http-fastify';

describe.each([
    { name: 'Express', app: appExpress },
    { name: 'Fastify', app: appFasitfy }
])('Health fail in HTTP App ($name)', ({ app, name }) => {
    let axiSparkCore: AxiSparkCore;

    beforeAll(async () => {
        axiSparkCore = AxiSparkTestFactory.create({
            app
        });
        await axiSparkCore.init();
        await axiSparkCore.run();
    });

    it('should create an instance of AxiSparkTestCore', () => {
        expect(axiSparkCore).toBeInstanceOf(AxiSparkCore);
    });

    it('should create the app with Health fail in HTTP plugin', async () => {
        const plugins = axiSparkCore.used();
        expect(plugins).toHaveLength(2);
        expect(plugins).toStrictEqual([
            {
                type: BadPlugin,
                options: undefined
            },
            {
                type: HttpPlugin,
                options: expect.objectContaining({
                    basePath: '/api',
                    adapter: name === 'Express' ? ExpressHttpAdapter : FastifyHttpAdapter,
                    healthChecks: true,
                    plugin: HttpPlugin,
                    port: 3000
                })
            }
        ]);
    });

    it('should fail GET requests to /health', async () => {
        const response = await fetch('http://localhost:3000/api/health', {
            method: 'GET'
        });
        expect(response.status).toBe(503);
        const data = await response.json();
        expect(data).toEqual(
            expect.objectContaining({
                status: 'unhealthy',
                timestamp: expect.any(String),
                checks: expect.arrayContaining([
                    expect.objectContaining({
                        component: 'Test',
                        status: 'unhealthy',
                        details: expect.any(Object)
                    }),
                    expect.objectContaining({
                        component: 'BadPlugin',
                        status: 'unhealthy',
                        details: expect.any(Object)
                    }),
                    expect.objectContaining({
                        component: 'HttpPlugin',
                        status: 'healthy',
                        details: expect.any(Object)
                    }),
                    expect.objectContaining({
                        component: 'payments-api',
                        status: 'unhealthy',
                        details: { error: 'Health check timed out after 100ms', critical: true }
                    })
                ])
            })
        );
    });

    it('should handle GET requests to /health/liveness', async () => {
        const response = await fetch('http://localhost:3000/api/health/liveness', {
            method: 'GET'
        });
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data).toEqual(
            expect.objectContaining({
                status: 'unhealthy',
                timestamp: expect.any(String)
            })
        );
    });

    it('should fail GET requests to /health/readiness', async () => {
        const response = await fetch('http://localhost:3000/api/health/readiness', {
            method: 'GET'
        });
        expect(response.status).toBe(503);
        const data = await response.json();
        expect(data).toEqual(
            expect.objectContaining({
                status: 503,
                error: 'Some components are not healthy: Test, BadPlugin, payments-api'
            })
        );
    });

    afterAll(async () => {
        await axiSparkCore.destroy();
    });
});
