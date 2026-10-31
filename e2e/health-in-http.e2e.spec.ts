import { AxiSparkTestFactory } from '@axisparkjs/test';
import { AxiSparkCore } from '@axisparkjs/core';
import { HttpPlugin } from '@axisparkjs/http';
import { app as appExpress } from '@axisparkjs/samples/health-in-http/src/app-express';
import { app as appFasitfy } from '@axisparkjs/samples/health-in-http/src/app-fastify';
import { ExpressHttpAdapter } from '@axisparkjs/http-express';
import { FastifyHttpAdapter } from '@axisparkjs/http-fastify';

describe.each([
    { name: 'Express', app: appExpress },
    { name: 'Fastify', app: appFasitfy }
])('Health in HTTP App ($name)', ({ app, name }) => {
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

    it('should create the app with Health in HTTP plugin', async () => {
        const plugins = axiSparkCore.used();
        expect(plugins).toHaveLength(1);
        expect(plugins).toStrictEqual([
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

    it('should handle GET requests to /health', async () => {
        const response = await fetch('http://localhost:3000/api/health', {
            method: 'GET'
        });
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data).toEqual(
            expect.objectContaining({
                status: 'healthy',
                timestamp: expect.any(String),
                checks: expect.arrayContaining([
                    expect.objectContaining({
                        component: 'Test',
                        status: 'healthy'
                    }),
                    expect.objectContaining({
                        component: 'HttpPlugin',
                        status: 'healthy'
                    }),
                    expect.objectContaining({
                        component: 'uptime',
                        status: 'healthy',
                        details: { uptime: expect.any(Number), critical: true }
                    }),
                    expect.objectContaining({
                        component: 'recommendations-api',
                        status: 'unhealthy',
                        details: { error: 'Recommendations API is not reachable', critical: false }
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
                status: 'healthy',
                timestamp: expect.any(String)
            })
        );
    });

    it('should handle GET requests to /health/readiness', async () => {
        const response = await fetch('http://localhost:3000/api/health/readiness', {
            method: 'GET'
        });
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data).toEqual(
            expect.objectContaining({
                status: 'healthy',
                timestamp: expect.any(String)
            })
        );
    });

    afterAll(async () => {
        await axiSparkCore.destroy();
    });
});
