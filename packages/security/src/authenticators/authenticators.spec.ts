import { ExecutionContext, ExecutionTransport } from '@axisparkjs/engine';
import { Authenticator } from '../types/authenticator';
import { ApiKeyAuthenticator, ApiKeySource } from './api-key-authenticator';
import { BasicAuthenticator, BasicCredentials } from './basic-authenticator';
import { BearerAuthenticator } from './bearer-authenticator';
import { CredentialAuthenticator } from './credential-authenticator';
import { firstValue, httpRequest, readAuthorization } from './http-credentials';
import { safeCompare } from './safe-compare';

const httpContext = (headers: Record<string, string | string[] | undefined> = {}, query: Record<string, string | string[]> = {}) =>
    ({
        transport: ExecutionTransport.Http,
        request: { getHeader: (name: string) => headers[name.toLowerCase()], query }
    }) as unknown as ExecutionContext;

const basic = (value: string) => `Basic ${Buffer.from(value, 'utf8').toString('base64')}`;

class TestBearer extends BearerAuthenticator<{ id: string }> {
    validate = jest.fn(async (token: string) => (token === 'valid-token' ? { id: 'alice' } : undefined));
}

class TestBasic extends BasicAuthenticator<{ id: string }> {
    validate = jest.fn(async ({ username, password }: BasicCredentials) =>
        username === 'alice' && safeCompare(password, 'secret') ? { id: username } : undefined
    );
}

class TestApiKey extends ApiKeyAuthenticator<{ client: string }> {
    validate = jest.fn(async (apiKey: string) => (safeCompare(apiKey, 'key-1') ? { client: 'one' } : undefined));
}

describe('built-in authenticators', () => {
    describe('CredentialAuthenticator', () => {
        class TestCredential extends CredentialAuthenticator<string, unknown> {
            extract = jest.fn();
            validate = jest.fn();
        }

        it('extends Authenticator and supports every transport by default', () => {
            expect(new TestCredential()).toBeInstanceOf(Authenticator);
            expect(TestCredential.transports).toEqual([ExecutionTransport.All]);
        });

        it('passes the extracted credential and the context to validate', async () => {
            const authenticator = new TestCredential();
            const context = httpContext();
            authenticator.extract.mockResolvedValue('credential');
            authenticator.validate.mockResolvedValue({ id: 'alice' });

            await expect(authenticator.authenticate(context)).resolves.toEqual({ id: 'alice' });
            expect(authenticator.extract).toHaveBeenCalledWith(context);
            expect(authenticator.validate).toHaveBeenCalledWith('credential', context);
        });

        it('does not call validate when there is no credential', async () => {
            const authenticator = new TestCredential();
            authenticator.extract.mockReturnValue(undefined);

            await expect(authenticator.authenticate(httpContext())).resolves.toBeUndefined();
            expect(authenticator.validate).not.toHaveBeenCalled();
        });

        it('returns undefined when validate returns a falsy value', async () => {
            const authenticator = new TestCredential();
            authenticator.extract.mockReturnValue('');
            authenticator.validate.mockResolvedValue(null);

            await expect(authenticator.authenticate(httpContext())).resolves.toBeUndefined();
            expect(authenticator.validate).toHaveBeenCalledWith('', expect.anything());
        });
    });

    describe('http credentials', () => {
        it('returns the first non-empty value', () => {
            expect(firstValue(['a', 'b'])).toBe('a');
            expect(firstValue('a')).toBe('a');
            expect(firstValue('')).toBeUndefined();
            expect(firstValue([])).toBeUndefined();
            expect(firstValue(undefined)).toBeUndefined();
        });

        it('returns the request only for HTTP-like contexts', () => {
            expect(httpRequest(httpContext())).toBeDefined();
            expect(httpRequest({ transport: ExecutionTransport.Other } as ExecutionContext)).toBeUndefined();
            expect(httpRequest({ request: {} } as unknown as ExecutionContext)).toBeUndefined();
        });

        it.each([
            ['Bearer abc', 'abc'],
            ['bearer abc', 'abc'],
            ['BEARER   abc  ', 'abc'],
            ['  Bearer\tabc', 'abc']
        ])('reads "%s" for the Bearer scheme', (header, expected) => {
            expect(readAuthorization(httpContext({ authorization: header }), 'Bearer')).toBe(expected);
        });

        it.each([undefined, '', 'Bearer', 'Bearer ', 'Basic abc', 'Bearer a b', 'Bearerabc'])('ignores the header %p', (header) => {
            expect(readAuthorization(httpContext({ authorization: header }), 'Bearer')).toBeUndefined();
        });

        it('reads the first Authorization header and ignores non-HTTP contexts', () => {
            expect(readAuthorization(httpContext({ authorization: ['Bearer one', 'Bearer two'] }), 'Bearer')).toBe('one');
            expect(readAuthorization({ transport: ExecutionTransport.Other } as ExecutionContext, 'Bearer')).toBeUndefined();
        });
    });

    describe('BearerAuthenticator', () => {
        it('declares the HTTP transport', () => {
            expect(BearerAuthenticator.transports).toEqual([ExecutionTransport.Http]);
            expect(TestBearer.transports).toEqual([ExecutionTransport.Http]);
        });

        it('authenticates a valid token with a case-insensitive scheme', async () => {
            const authenticator = new TestBearer();

            await expect(authenticator.authenticate(httpContext({ authorization: 'bearer valid-token' }))).resolves.toEqual({ id: 'alice' });
            expect(authenticator.validate).toHaveBeenCalledWith('valid-token', expect.anything());
        });

        it('rejects invalid tokens and requests without a Bearer token', async () => {
            const authenticator = new TestBearer();

            await expect(authenticator.authenticate(httpContext({ authorization: 'Bearer other' }))).resolves.toBeUndefined();
            await expect(authenticator.authenticate(httpContext({ authorization: 'Basic valid-token' }))).resolves.toBeUndefined();
            await expect(authenticator.authenticate(httpContext())).resolves.toBeUndefined();
            expect(authenticator.validate).toHaveBeenCalledTimes(1);
        });
    });

    describe('BasicAuthenticator', () => {
        it('declares the HTTP transport', () => {
            expect(BasicAuthenticator.transports).toEqual([ExecutionTransport.Http]);
        });

        it('decodes the username and password', async () => {
            const authenticator = new TestBasic();

            await expect(authenticator.authenticate(httpContext({ authorization: basic('alice:secret') }))).resolves.toEqual({ id: 'alice' });
            expect(authenticator.validate).toHaveBeenCalledWith({ username: 'alice', password: 'secret' }, expect.anything());
        });

        it('splits at the first colon and decodes UTF-8', async () => {
            const authenticator = new TestBasic();

            await authenticator.authenticate(httpContext({ authorization: basic('jöse:pa:ss:') }));
            await authenticator.authenticate(httpContext({ authorization: basic(':') }));

            expect(authenticator.validate).toHaveBeenNthCalledWith(1, { username: 'jöse', password: 'pa:ss:' }, expect.anything());
            expect(authenticator.validate).toHaveBeenNthCalledWith(2, { username: '', password: '' }, expect.anything());
        });

        it('rejects wrong passwords', async () => {
            await expect(new TestBasic().authenticate(httpContext({ authorization: basic('alice:wrong') }))).resolves.toBeUndefined();
        });

        it.each([undefined, 'Bearer abc', 'Basic not-base64!', 'Basic YWJj', `Basic ${Buffer.from('alice').toString('base64')}`, 'Basic YWxpY2U6c2VjcmV0='])(
            'ignores the header %p',
            async (authorization) => {
                const authenticator = new TestBasic();

                await expect(authenticator.authenticate(httpContext({ authorization }))).resolves.toBeUndefined();
                expect(authenticator.validate).not.toHaveBeenCalled();
            }
        );
    });

    describe('ApiKeyAuthenticator', () => {
        it('declares the HTTP transport and reads X-API-Key by default', async () => {
            const authenticator = new TestApiKey();

            expect(ApiKeyAuthenticator.transports).toEqual([ExecutionTransport.Http]);
            await expect(authenticator.authenticate(httpContext({ 'x-api-key': 'key-1' }))).resolves.toEqual({ client: 'one' });
            await expect(authenticator.authenticate(httpContext({ 'x-api-key': 'key-2' }))).resolves.toBeUndefined();
            await expect(authenticator.authenticate(httpContext({}, { api_key: 'key-1' }))).resolves.toBeUndefined();
        });

        it('reads a custom header case-insensitively', async () => {
            class HeaderApiKey extends TestApiKey {
                protected readonly source: ApiKeySource = { header: 'X-Client-Key' };
            }

            await expect(new HeaderApiKey().authenticate(httpContext({ 'x-client-key': 'key-1' }))).resolves.toEqual({ client: 'one' });
        });

        it('reads a query parameter, after the header when both are set', async () => {
            class QueryApiKey extends TestApiKey {
                protected readonly source: ApiKeySource = { header: 'x-api-key', query: 'api_key' };
            }
            const authenticator = new QueryApiKey();

            await expect(authenticator.authenticate(httpContext({}, { api_key: ['key-1', 'key-2'] }))).resolves.toEqual({ client: 'one' });
            await authenticator.authenticate(httpContext({ 'x-api-key': 'from-header' }, { api_key: 'key-1' }));
            expect(authenticator.validate).toHaveBeenLastCalledWith('from-header', expect.anything());
        });

        it('reads only the query parameter when no header is set', async () => {
            class QueryOnlyApiKey extends TestApiKey {
                protected readonly source: ApiKeySource = { query: 'api_key' };
            }
            const authenticator = new QueryOnlyApiKey();

            await expect(authenticator.authenticate(httpContext({ 'x-api-key': 'key-1' }))).resolves.toBeUndefined();
            await expect(authenticator.authenticate(httpContext({}, { api_key: 'key-1' }))).resolves.toEqual({ client: 'one' });
        });

        it('ignores empty keys, requests without query and non-HTTP contexts', async () => {
            const authenticator = new TestApiKey();
            const withoutQuery = { request: { getHeader: () => undefined } } as unknown as ExecutionContext;
            class QueryApiKey extends TestApiKey {
                protected readonly source: ApiKeySource = { query: 'api_key' };
            }

            await expect(authenticator.authenticate(httpContext({ 'x-api-key': '' }))).resolves.toBeUndefined();
            await expect(new QueryApiKey().authenticate(withoutQuery)).resolves.toBeUndefined();
            await expect(authenticator.authenticate({ transport: ExecutionTransport.Other } as ExecutionContext)).resolves.toBeUndefined();
            expect(authenticator.validate).not.toHaveBeenCalled();
        });
    });

    describe('safeCompare', () => {
        it('compares strings and buffers of any length', () => {
            expect(safeCompare('secret', 'secret')).toBe(true);
            expect(safeCompare(Buffer.from('secret'), 'secret')).toBe(true);
            expect(safeCompare('secret', 'Secret')).toBe(false);
            expect(safeCompare('secret', 'secret-but-longer')).toBe(false);
            expect(safeCompare('', '')).toBe(true);
        });
    });
});
