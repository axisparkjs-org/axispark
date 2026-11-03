import { AxiSparkCore } from '@axisparkjs/core';
import { AxiSparkTestFactory } from '@axisparkjs/test';
import { HttpPlugin } from '@axisparkjs/http';
import { FastifyHttpAdapter } from '@axisparkjs/http-fastify';
import { app } from '@axisparkjs/samples/feel-secured/src/app';

describe('Feel Secured App', () => {
    const port = 3000;
    let core: AxiSparkCore;
    const baseUrl = `http://localhost:${port}/api`;

    beforeAll(async () => {
        core = AxiSparkTestFactory.create({ app });
        await core.init();
        await core.run();
    });

    it('registers the HTTP app and configured adapter', () => {
        expect(core).toBeInstanceOf(AxiSparkCore);
        expect(core.used()).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    type: HttpPlugin,
                    options: expect.objectContaining({ adapter: FastifyHttpAdapter, basePath: '/api', port })
                })
            ])
        );
    });

    it('allows a public route without credentials', async () => {
        const response = await fetch(`${baseUrl}/access/public`);

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ access: 'public' });
    });

    it('allows a public route even when an invalid credential is supplied', async () => {
        const response = await fetch(`${baseUrl}/access/public`, {
            headers: { Authorization: 'Bearer invalid-token' }
        });

        expect(response.status).toBe(200);
    });

    it('supports optional authentication on a public route', async () => {
        const anonymousResponse = await fetch(`${baseUrl}/access/identity`);
        expect(anonymousResponse.status).toBe(200);
        await expect(anonymousResponse.json()).resolves.toEqual({ authenticated: false, principal: null });

        const authenticatedResponse = await fetch(`${baseUrl}/access/identity`, {
            headers: { Authorization: 'Bearer alice-token' }
        });
        expect(authenticatedResponse.status).toBe(200);
        await expect(authenticatedResponse.json()).resolves.toEqual({
            authenticated: true,
            principal: { id: 'alice', role: 'reader', active: true }
        });
    });

    it('requires a valid identity on a protected route', async () => {
        const anonymous = await fetch(`${baseUrl}/access/required`);
        expect(anonymous.status).toBe(401);

        const invalid = await fetch(`${baseUrl}/access/required`, {
            headers: { Authorization: 'Bearer invalid-token' }
        });
        expect(invalid.status).toBe(401);

        const authenticated = await fetch(`${baseUrl}/access/required`, {
            headers: { Authorization: 'Bearer alice-token' }
        });
        expect(authenticated.status).toBe(200);
        await expect(authenticated.json()).resolves.toEqual({ access: 'authenticated' });
    });

    it('reads the Bearer scheme case-insensitively and ignores other schemes', async () => {
        const lowercase = await fetch(`${baseUrl}/access/required`, {
            headers: { Authorization: 'bearer alice-token' }
        });
        expect(lowercase.status).toBe(200);

        const otherScheme = await fetch(`${baseUrl}/access/required`, {
            headers: { Authorization: 'Basic alice-token' }
        });
        expect(otherScheme.status).toBe(401);
    });

    it('applies a method policy and distinguishes forbidden from unauthenticated', async () => {
        const anonymous = await fetch(`${baseUrl}/access/admin`);
        expect(anonymous.status).toBe(401);

        const reader = await fetch(`${baseUrl}/access/admin`, {
            headers: { Authorization: 'Bearer alice-token' }
        });
        expect(reader.status).toBe(403);

        const administrator = await fetch(`${baseUrl}/access/admin`, {
            headers: { Authorization: 'Bearer admin-token' }
        });
        expect(administrator.status).toBe(200);
        await expect(administrator.json()).resolves.toEqual({ access: 'admin' });
    });

    it('combines class and method policies and checks resource ownership', async () => {
        const owner = await fetch(`${baseUrl}/documents/alice`, {
            headers: { Authorization: 'Bearer alice-token' }
        });
        expect(owner.status).toBe(200);
        await expect(owner.json()).resolves.toEqual({ ownerId: 'alice', principal: 'alice' });

        const otherOwner = await fetch(`${baseUrl}/documents/bob`, {
            headers: { Authorization: 'Bearer alice-token' }
        });
        expect(otherOwner.status).toBe(403);

        const inactive = await fetch(`${baseUrl}/documents/disabled`, {
            headers: { Authorization: 'Bearer disabled-token' }
        });
        expect(inactive.status).toBe(403);

        const administrator = await fetch(`${baseUrl}/documents/bob`, {
            headers: { Authorization: 'Bearer admin-token' }
        });
        expect(administrator.status).toBe(200);
    });

    afterAll(async () => {
        await core.destroy();
    });
});
