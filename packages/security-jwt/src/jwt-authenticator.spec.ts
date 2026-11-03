import { createServer, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { ExecutionContext, ExecutionTransport } from '@axisparkjs/engine';
import { Authenticator, BearerAuthenticator } from '@axisparkjs/security';
import { exportJWK, exportSPKI, generateKeyPair, JWTPayload, SignJWT } from 'jose';
import { JwtAuthenticator } from './jwt-authenticator';
import { JwtAuthenticatorOptions } from './jwt-authenticator-options';

const SECRET = 'a-very-long-secret-used-only-in-the-tests';

const context = (authorization?: string) =>
    ({
        transport: ExecutionTransport.Http,
        request: { getHeader: (name: string) => (name === 'authorization' ? authorization : undefined), query: {} }
    }) as unknown as ExecutionContext;

interface SignOptions {
    alg?: string;
    key?: any;
    kid?: string;
    exp?: string | number;
}

const sign = (claims: JWTPayload = {}, { alg = 'HS256', key = new TextEncoder().encode(SECRET), kid, exp = '5m' }: SignOptions = {}) =>
    new SignJWT(claims)
        .setProtectedHeader({ alg, kid })
        .setSubject('alice')
        .setIssuedAt()
        .setIssuer('my-app')
        .setAudience('my-api')
        .setExpirationTime(exp)
        .sign(key);

const authenticatorWith = (options: JwtAuthenticatorOptions) =>
    new (class extends JwtAuthenticator {
        protected readonly options = options;
    })();

describe('JwtAuthenticator', () => {
    it('is a Bearer authenticator for HTTP', () => {
        const authenticator = authenticatorWith({ secret: SECRET, algorithms: ['HS256'] });

        expect(authenticator).toBeInstanceOf(BearerAuthenticator);
        expect(authenticator).toBeInstanceOf(Authenticator);
        expect(JwtAuthenticator.transports).toEqual([ExecutionTransport.Http]);
    });

    describe('with a secret', () => {
        const authenticator = authenticatorWith({ secret: SECRET, algorithms: ['HS256'], issuer: 'my-app', audience: 'my-api' });

        it('returns the verified claims by default', async () => {
            const token = await sign({ role: 'admin' });

            await expect(authenticator.authenticate(context(`Bearer ${token}`))).resolves.toMatchObject({
                sub: 'alice',
                role: 'admin',
                iss: 'my-app',
                aud: 'my-api'
            });
        });

        it('accepts the secret as bytes', async () => {
            const bytes = authenticatorWith({ secret: new TextEncoder().encode(SECRET), algorithms: ['HS256'] });

            await expect(bytes.authenticate(context(`Bearer ${await sign()}`))).resolves.toMatchObject({ sub: 'alice' });
        });

        it.each([
            ['a token signed with another secret', () => sign({}, { key: new TextEncoder().encode('another-secret-another-secret-another') })],
            ['an expired token', () => sign({}, { exp: Math.floor(Date.now() / 1000) - 60 })],
            [
                'a token with another issuer',
                () => new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setIssuer('other').setAudience('my-api').sign(new TextEncoder().encode(SECRET))
            ],
            [
                'a token for another audience',
                () => new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setIssuer('my-app').setAudience('other').sign(new TextEncoder().encode(SECRET))
            ],
            [
                'a token that is not valid yet',
                () =>
                    new SignJWT({})
                        .setProtectedHeader({ alg: 'HS256' })
                        .setIssuer('my-app')
                        .setAudience('my-api')
                        .setNotBefore('10m')
                        .sign(new TextEncoder().encode(SECRET))
            ],
            ['a token with a not allowed algorithm', () => sign({}, { alg: 'HS512' })],
            [
                'an unsigned token',
                async () => `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from('{"sub":"alice"}').toString('base64url')}.`
            ],
            ['a malformed token', async () => 'not-a-jwt']
        ])('rejects %s', async (_, token) => {
            await expect(authenticator.authenticate(context(`Bearer ${await token()}`))).resolves.toBeUndefined();
        });

        it('returns undefined without a Bearer token', async () => {
            await expect(authenticator.authenticate(context())).resolves.toBeUndefined();
            await expect(authenticator.authenticate(context('Basic abc'))).resolves.toBeUndefined();
        });

        it('applies the clock tolerance, the maximum age and the required claims', async () => {
            const tolerant = authenticatorWith({ secret: SECRET, algorithms: ['HS256'], clockTolerance: 120 });
            const expired = await sign({}, { exp: Math.floor(Date.now() / 1000) - 60 });
            await expect(tolerant.authenticate(context(`Bearer ${expired}`))).resolves.toMatchObject({ sub: 'alice' });

            const strict = authenticatorWith({ secret: SECRET, algorithms: ['HS256'], maxTokenAge: '1h', requiredClaims: ['role'] });
            await expect(strict.authenticate(context(`Bearer ${await sign()}`))).resolves.toBeUndefined();
            await expect(strict.authenticate(context(`Bearer ${await sign({ role: 'reader' })}`))).resolves.toMatchObject({ role: 'reader' });
        });
    });

    describe('toPrincipal', () => {
        class PrincipalAuthenticator extends JwtAuthenticator<{ id: string; role: string }> {
            protected readonly options = { secret: SECRET, algorithms: ['HS256'] };
            readonly mapped = jest.fn();

            protected async toPrincipal(claims: JWTPayload, executionContext: ExecutionContext) {
                this.mapped(claims, executionContext);
                return claims.role === 'disabled' ? undefined : { id: claims.sub as string, role: claims.role as string };
            }
        }

        it('maps the verified claims and receives the execution context', async () => {
            const authenticator = new PrincipalAuthenticator();
            const executionContext = context(`Bearer ${await sign({ role: 'admin' })}`);

            await expect(authenticator.authenticate(executionContext)).resolves.toEqual({ id: 'alice', role: 'admin' });
            expect(authenticator.mapped).toHaveBeenCalledWith(expect.objectContaining({ sub: 'alice' }), executionContext);
        });

        it('rejects the token when toPrincipal returns undefined', async () => {
            await expect(new PrincipalAuthenticator().authenticate(context(`Bearer ${await sign({ role: 'disabled' })}`))).resolves.toBeUndefined();
        });

        it('propagates errors that are not token errors', async () => {
            const failing = new (class extends JwtAuthenticator {
                protected readonly options = { secret: SECRET, algorithms: ['HS256'] };
                protected async toPrincipal(): Promise<undefined> {
                    throw new Error('Database unavailable');
                }
            })();

            await expect(failing.authenticate(context(`Bearer ${await sign()}`))).rejects.toThrow('Database unavailable');
        });
    });

    describe('with a public key', () => {
        it('verifies RS256 tokens with a PEM key and ES256 tokens with a CryptoKey', async () => {
            const rsa = await generateKeyPair('RS256');
            const pem = authenticatorWith({ publicKey: await exportSPKI(rsa.publicKey), algorithms: ['RS256'] });
            await expect(pem.authenticate(context(`Bearer ${await sign({}, { alg: 'RS256', key: rsa.privateKey })}`))).resolves.toMatchObject({
                sub: 'alice'
            });

            const ec = await generateKeyPair('ES256');
            const cryptoKey = authenticatorWith({ publicKey: ec.publicKey, algorithms: ['ES256'] });
            await expect(cryptoKey.authenticate(context(`Bearer ${await sign({}, { alg: 'ES256', key: ec.privateKey })}`))).resolves.toMatchObject({
                sub: 'alice'
            });
        });

        it('rejects tokens signed with another key or with the public key as an HMAC secret', async () => {
            const rsa = await generateKeyPair('RS256');
            const other = await generateKeyPair('RS256');
            const publicPem = await exportSPKI(rsa.publicKey);
            const authenticator = authenticatorWith({ publicKey: publicPem, algorithms: ['RS256'] });

            await expect(authenticator.authenticate(context(`Bearer ${await sign({}, { alg: 'RS256', key: other.privateKey })}`))).resolves.toBeUndefined();
            await expect(
                authenticator.authenticate(context(`Bearer ${await sign({}, { alg: 'HS256', key: new TextEncoder().encode(publicPem) })}`))
            ).resolves.toBeUndefined();
        });
    });

    describe('with a JWKS URI', () => {
        let server: Server;
        let jwksUri: string;
        let keyPair: Awaited<ReturnType<typeof generateKeyPair>>;
        let requests = 0;

        beforeAll(async () => {
            keyPair = await generateKeyPair('ES256');
            const jwk = { ...(await exportJWK(keyPair.publicKey)), kid: 'key-1', alg: 'ES256', use: 'sig' };
            server = createServer((_, response) => {
                requests++;
                response.setHeader('content-type', 'application/json');
                response.end(JSON.stringify({ keys: [jwk] }));
            });
            await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
            jwksUri = `http://127.0.0.1:${(server.address() as AddressInfo).port}/.well-known/jwks.json`;
        });

        afterAll(async () => {
            await new Promise((resolve) => server.close(resolve));
        });

        it('downloads the key set once and selects the key by kid', async () => {
            const authenticator = authenticatorWith({ jwksUri, algorithms: ['ES256'] });
            const token = await sign({}, { alg: 'ES256', key: keyPair.privateKey, kid: 'key-1' });

            await expect(authenticator.authenticate(context(`Bearer ${token}`))).resolves.toMatchObject({ sub: 'alice' });
            await expect(authenticator.authenticate(context(`Bearer ${token}`))).resolves.toMatchObject({ sub: 'alice' });
            expect(requests).toBe(1);
        });

        it('rejects tokens with an unknown kid', async () => {
            const other = await generateKeyPair('ES256');
            const authenticator = authenticatorWith({ jwksUri, algorithms: ['ES256'] });

            await expect(
                authenticator.authenticate(context(`Bearer ${await sign({}, { alg: 'ES256', key: other.privateKey, kid: 'unknown' })}`))
            ).resolves.toBeUndefined();
        });
    });

    describe('options', () => {
        it.each<[string, Partial<JwtAuthenticatorOptions>, string]>([
            ['without algorithms', { secret: SECRET }, "'algorithms' must contain at least one algorithm"],
            ['with empty algorithms', { secret: SECRET, algorithms: [] }, "'algorithms' must contain at least one algorithm"],
            ['with the none algorithm', { secret: SECRET, algorithms: ['HS256', 'none'] }, "the 'none' algorithm is not allowed"],
            ['without a key', { algorithms: ['HS256'] }, "set exactly one of 'secret', 'publicKey' or 'jwksUri'"],
            ['with an empty secret', { secret: '', algorithms: ['HS256'] }, "set exactly one of 'secret', 'publicKey' or 'jwksUri'"],
            [
                'with two keys',
                { secret: SECRET, jwksUri: 'https://example.com/jwks', algorithms: ['HS256'] },
                "set exactly one of 'secret', 'publicKey' or 'jwksUri'"
            ]
        ])('throws %s', async (_, options, message) => {
            const authenticator = authenticatorWith(options as JwtAuthenticatorOptions);

            await expect(authenticator.authenticate(context(`Bearer ${await sign()}`))).rejects.toThrow(message);
        });

        it('throws when the options are missing', async () => {
            const authenticator = authenticatorWith(undefined as unknown as JwtAuthenticatorOptions);

            await expect(authenticator.authenticate(context(`Bearer ${await sign()}`))).rejects.toThrow("'algorithms' must contain at least one algorithm");
        });

        it('does not validate the options when there is no token', async () => {
            await expect(authenticatorWith({ algorithms: [] }).authenticate(context())).resolves.toBeUndefined();
        });
    });
});
