import { request as httpRequest } from 'node:http';
import { AxiSparkTestFactory } from '@axisparkjs/test';
import { AxiSparkCore } from '@axisparkjs/core';
import { HttpPlugin } from '@axisparkjs/http';
import { app as appExpress } from '@axisparkjs/samples/versioning-and-timeouts/src/app-express';
import { app as appFasitfy } from '@axisparkjs/samples/versioning-and-timeouts/src/app-fastify';
import { reportRuns } from '@axisparkjs/samples/versioning-and-timeouts/src/controller';
import { ExpressHttpAdapter } from '@axisparkjs/http-express';
import { FastifyHttpAdapter } from '@axisparkjs/http-fastify';

describe.each([
    { name: 'Express', app: appExpress },
    { name: 'Fastify', app: appFasitfy }
])('Versioning and Timeouts App ($name)', ({ app, name }) => {
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

    it('should create the app', async () => {
        const plugins = axiSparkCore.used();
        expect(plugins).toHaveLength(1);
        expect(plugins).toStrictEqual([
            {
                type: HttpPlugin,
                options: expect.objectContaining({
                    basePath: '/api',
                    adapter: name === 'Express' ? ExpressHttpAdapter : FastifyHttpAdapter,
                    plugin: HttpPlugin,
                    port: 3000
                })
            }
        ]);
    });

    it('should handle GET requests to /v1/versions', async () => {
        const response = await fetch('http://localhost:3000/api/v1/versions', {
            method: 'GET'
        });
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ message: 'This is a GET request example for the default version' });
    });

    it('should handle GET requests to /v2/versions', async () => {
        const response = await fetch('http://localhost:3000/api/v2/versions', {
            method: 'GET'
        });
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ message: 'This is a GET request example for version 2' });
    });

    it('should handle GET requests to /v3/versions', async () => {
        const response = await fetch('http://localhost:3000/api/v3/versions', {
            method: 'GET'
        });
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ message: 'This is a GET request example for version 3' });
    });

    it('should fail GET requests to /v4/versions', async () => {
        const response = await fetch('http://localhost:3000/api/v4/versions', {
            method: 'GET'
        });
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual(expect.objectContaining({ error: 'Invalid version requested for GET /api/v4/versions' }));
    });

    it('should handle GET requests to /timeouts and timeout after 0.3 seconds', async () => {
        const response = await fetch('http://localhost:3000/api/v1/timeouts', {
            method: 'GET'
        });
        expect(response.status).toBe(408);
        expect(await response.json()).toEqual(expect.objectContaining({ error: 'Request timeout after 300 ms' }));
    });

    it('should handle GET requests to /timeouts/no-timeout and return a response', async () => {
        const response = await fetch('http://localhost:3000/api/v1/timeouts/no-timeout', {
            method: 'GET'
        });
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ message: 'This is a GET request example for no timeouts' });
    });

    it('should handle GET requests to /timeouts/disabled-timeout with @NoTimeout() and return a response after the default timeout', async () => {
        const start = Date.now();
        const response = await fetch('http://localhost:3000/api/v1/timeouts/disabled-timeout', {
            method: 'GET'
        });
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ message: 'This is a GET request example with the timeout disabled' });
        expect(Date.now() - start).toBeGreaterThanOrEqual(450);
    });

    it('should handle GET requests to /timeouts-disabled with @NoTimeout() in the class and return a response', async () => {
        const response = await fetch('http://localhost:3000/api/v1/timeouts-disabled', {
            method: 'GET'
        });
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ message: 'This is a GET request example with the timeout disabled in its class' });
    });

    it('should handle GET requests to /timeouts-disabled/method-timeout and timeout after the time of the method', async () => {
        const response = await fetch('http://localhost:3000/api/v1/timeouts-disabled/method-timeout', {
            method: 'GET'
        });
        expect(response.status).toBe(408);
        expect(await response.json()).toEqual(expect.objectContaining({ error: 'Request timeout after 100 ms' }));
    });

    it('should handle GET requests to /timeouts/throw-timeout and timeout after 0.3 seconds', async () => {
        const response = await fetch('http://localhost:3000/api/v1/timeouts/throw-timeout', {
            method: 'GET'
        });
        expect(response.status).toBe(408);
        expect(await response.json()).toEqual(expect.objectContaining({ error: 'Request timeout after 300 ms' }));
    });

    it('should handle GET requests to /timeouts/throw-timeout and handle GET requests to /timeouts/no-timeout', async () => {
        const response = await fetch('http://localhost:3000/api/v1/timeouts/throw-timeout', {
            method: 'GET'
        });
        expect(response.status).toBe(408);
        expect(await response.json()).toEqual(expect.objectContaining({ error: 'Request timeout after 300 ms' }));

        const response2 = await fetch('http://localhost:3000/api/v1/timeouts/no-timeout', {
            method: 'GET'
        });
        expect(response2.status).toBe(200);
        expect(await response2.json()).toEqual({ message: 'This is a GET request example for no timeouts' });
    });

    it('should abort the signal of a handler that times out and stop its work', async () => {
        const response = await fetch('http://localhost:3000/api/v1/reports/timed');

        expect(response.status).toBe(408);
        expect(await response.json()).toEqual(expect.objectContaining({ error: 'Request timeout after 200 ms' }));

        await new Promise((resolve) => setTimeout(resolve, 200));
        expect(reportRuns.timed).toEqual(expect.objectContaining({ stopped: true, reason: 'ExecutionTimeoutError' }));
        expect(reportRuns.timed.steps).toBeLessThan(5);
    });

    it('should abort the signal of a handler when the client disconnects', async () => {
        // A dedicated connection, closed by the client while the handler is running.
        const request = httpRequest('http://localhost:3000/api/v1/reports/long', { agent: false });
        request.on('error', () => undefined);
        request.end();
        await new Promise((resolve) => setTimeout(resolve, 150));
        request.destroy();

        await new Promise((resolve) => setTimeout(resolve, 200));
        expect(reportRuns.long).toEqual(expect.objectContaining({ stopped: true, reason: 'ClientDisconnectedError' }));
        expect(reportRuns.long.steps).toBeLessThan(10);
    });

    afterAll(async () => {
        await axiSparkCore.destroy();
    });
});
