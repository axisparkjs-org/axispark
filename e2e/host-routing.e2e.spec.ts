import { once } from 'node:events';
import { request } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { AxiSparkCore } from '@axisparkjs/core';
import { AxiSparkTestFactory } from '@axisparkjs/test';
import { HTTP_ADAPTER, HttpAdapter } from '@axisparkjs/http';
import { app as appExpress } from '@axisparkjs/samples/host-routing/src/app-express';
import { app as appFastify } from '@axisparkjs/samples/host-routing/src/app-fastify';

function getJson(url: string, host: string): Promise<{ status: number; json: () => Promise<unknown> }> {
    const parsedUrl = new URL(url);
    return new Promise((resolve, reject) => {
        const outgoingRequest = request(
            {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port,
                path: parsedUrl.pathname,
                method: 'GET',
                headers: { host }
            },
            (response) => {
                let body = '';
                response.setEncoding('utf8');
                response.on('data', (chunk: string) => (body += chunk));
                response.on('end', () => {
                    let json: unknown;
                    try {
                        json = JSON.parse(body);
                    } catch {
                        json = undefined;
                    }
                    resolve({ status: response.statusCode ?? 0, json: async () => json });
                });
            }
        );
        outgoingRequest.on('error', reject);
        outgoingRequest.end();
    });
}

describe.each([
    { name: 'Express', app: appExpress },
    { name: 'Fastify', app: appFastify }
])('Host-based routing ($name)', ({ app }) => {
    let core: AxiSparkCore;
    let baseUrl: string;

    beforeAll(async () => {
        core = AxiSparkTestFactory.create({ app });
        await core.init();
        await core.run();

        const adapter = await core.get<HttpAdapter>(HTTP_ADAPTER);
        const server = adapter.getHttpServer() as Server;
        if (!server.listening) await once(server, 'listening');
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}/api`;
    });

    afterAll(async () => {
        await core?.destroy();
    });

    it('routes the same path to the controller for the matching host', async () => {
        const adminResponse = await getJson(`${baseUrl}/users`, 'ADMIN.EXAMPLE.TEST:3000');
        expect(adminResponse.status).toBe(200);
        expect(await adminResponse.json()).toEqual({ surface: 'admin' });

        const apiResponse = await getJson(`${baseUrl}/users`, 'api.example.test');
        expect(apiResponse.status).toBe(200);
        expect(await apiResponse.json()).toEqual({ surface: 'api' });
    });

    it('supports wildcard and named host labels', async () => {
        const wildcardResponse = await getJson(`${baseUrl}/users`, 'acme.wildcard.example.test');
        expect(wildcardResponse.status).toBe(200);
        expect(await wildcardResponse.json()).toEqual({ surface: 'wildcard' });

        const namedResponse = await getJson(`${baseUrl}/users`, 'globex.named.example.test');
        expect(namedResponse.status).toBe(200);
        expect(await namedResponse.json()).toEqual({ surface: 'named-tenant' });
    });

    it('returns 404 for unmatched hosts and keeps unrestricted routes available', async () => {
        const unmatchedResponse = await getJson(`${baseUrl}/users`, 'unknown.example.test');
        expect(unmatchedResponse.status).toBe(404);

        const publicResponse = await getJson(`${baseUrl}/public`, 'unknown.example.test');
        expect(publicResponse.status).toBe(200);
        expect(await publicResponse.json()).toEqual({ surface: 'public' });
    });
});
