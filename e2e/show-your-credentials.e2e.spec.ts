import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { AxiSparkCore } from '@axisparkjs/core';
import { AxiSparkTestFactory } from '@axisparkjs/test';
import { HTTP_ADAPTER, HttpAdapter } from '@axisparkjs/http';
import { SignJWT } from 'jose';
import { app } from '@axisparkjs/samples/show-your-credentials/src/app';
import { JWT_AUDIENCE, JWT_ISSUER, JWT_SECRET } from '@axisparkjs/samples/show-your-credentials/src/authenticators';

const basic = (username: string, password: string) => `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

const jwt = ({
    sub = 'carol',
    role = 'reader',
    secret = JWT_SECRET,
    alg = 'HS256',
    issuer = JWT_ISSUER,
    audience = JWT_AUDIENCE,
    expiresAt = '5m' as string | number
} = {}) =>
    new SignJWT({ role })
        .setProtectedHeader({ alg })
        .setSubject(sub)
        .setIssuer(issuer)
        .setAudience(audience)
        .setIssuedAt()
        .setExpirationTime(expiresAt)
        .sign(new TextEncoder().encode(secret));

describe('Show Your Credentials App', () => {
    let core: AxiSparkCore;
    let baseUrl: string;

    const get = (path: string, headers: Record<string, string> = {}) => fetch(`${baseUrl}${path}`, { headers });

    beforeAll(async () => {
        core = AxiSparkTestFactory.create({ app });
        await core.init();
        await core.run();

        const adapter = await core.get<HttpAdapter>(HTTP_ADAPTER);
        const server = adapter.getHttpServer() as Server;
        if (!server.listening) await once(server, 'listening');
        baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/credentials`;
    });

    afterAll(async () => {
        await core?.destroy();
    });

    it('allows a public route without credentials', async () => {
        const response = await get('/public');

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ access: 'public' });
    });

    it('rejects a secured route without credentials', async () => {
        expect((await get('/me')).status).toBe(401);
    });

    describe('Basic', () => {
        it('authenticates a valid username and password', async () => {
            const response = await get('/me', { Authorization: basic('alice', 'alice-password') });

            expect(response.status).toBe(200);
            await expect(response.json()).resolves.toEqual({
                authenticator: 'UserBasicAuthenticator',
                principal: { id: 'alice', role: 'reader', via: 'basic' }
            });
        });

        it('rejects a wrong password, an unknown user and malformed credentials', async () => {
            expect((await get('/me', { Authorization: basic('alice', 'wrong') })).status).toBe(401);
            expect((await get('/me', { Authorization: basic('mallory', 'alice-password') })).status).toBe(401);
            expect((await get('/me', { Authorization: 'Basic not-base64!' })).status).toBe(401);
        });

        it('applies the authorization policies to the principal', async () => {
            expect((await get('/admin', { Authorization: basic('alice', 'alice-password') })).status).toBe(403);
            expect((await get('/admin', { Authorization: basic('admin', 'admin-password') })).status).toBe(200);
        });
    });

    describe('API key', () => {
        it('authenticates a key sent in the X-API-Key header or the api_key query parameter', async () => {
            const header = await get('/me', { 'X-API-Key': 'reporting-key' });
            expect(header.status).toBe(200);
            await expect(header.json()).resolves.toEqual({
                authenticator: 'ClientApiKeyAuthenticator',
                principal: { id: 'reporting-service', role: 'reader', via: 'api-key' }
            });

            const query = await get('/admin?api_key=billing-key');
            expect(query.status).toBe(200);
            await expect(query.json()).resolves.toEqual({ access: 'admin', id: 'billing-service' });
        });

        it('rejects unknown keys', async () => {
            expect((await get('/me', { 'X-API-Key': 'unknown-key' })).status).toBe(401);
            expect((await get('/me?api_key=unknown-key')).status).toBe(401);
        });
    });

    describe('JWT', () => {
        it('authenticates a valid token and maps its claims to the principal', async () => {
            const response = await get('/me', { Authorization: `Bearer ${await jwt({ sub: 'carol', role: 'admin' })}` });

            expect(response.status).toBe(200);
            await expect(response.json()).resolves.toEqual({
                authenticator: 'AppJwtAuthenticator',
                principal: { id: 'carol', role: 'admin', via: 'jwt' }
            });
            expect((await get('/admin', { Authorization: `Bearer ${await jwt({ role: 'admin' })}` })).status).toBe(200);
            expect((await get('/admin', { Authorization: `Bearer ${await jwt()}` })).status).toBe(403);
        });

        it.each([
            ['an invalid signature', { secret: 'another-secret-another-secret-another-secret' }],
            ['a not allowed algorithm', { alg: 'HS512' }],
            ['an expired token', { expiresAt: Math.floor(Date.now() / 1000) - 60 }],
            ['another issuer', { issuer: 'someone-else' }],
            ['another audience', { audience: 'another-api' }]
        ])('rejects a token with %s', async (_, options) => {
            expect((await get('/me', { Authorization: `Bearer ${await jwt(options)}` })).status).toBe(401);
        });

        it('rejects malformed tokens', async () => {
            expect((await get('/me', { Authorization: 'Bearer not-a-jwt' })).status).toBe(401);
        });
    });
});
