import { ExecutionContext, ExecutionTransport } from '@axisparkjs/engine';
import { CredentialAuthenticator } from './credential-authenticator';
import { readAuthorization } from './http-credentials';

/** Username and password decoded from an `Authorization: Basic` header. */
export interface BasicCredentials {
    username: string;
    password: string;
}

/**
 * Authenticator for HTTP requests with an `Authorization: Basic <base64>` header (RFC 7617). The scheme is
 * case-insensitive, and the credentials are decoded as UTF-8 and split at the first `:`.
 *
 * Implement {@link validate} to check the username and password. Compare passwords with `safeCompare` or with a
 * password hashing library, never with `===`.
 * @template TPrincipal Application-defined principal returned for valid credentials.
 */
export abstract class BasicAuthenticator<TPrincipal = unknown> extends CredentialAuthenticator<BasicCredentials, TPrincipal> {
    static readonly transports: readonly ExecutionTransport[] = [ExecutionTransport.Http];

    /**
     * Reads and decodes the `Authorization: Basic <base64>` header.
     * @returns The credentials, or `undefined` when the header is missing, is not valid Base64 or has no `:`.
     */
    protected extract(executionContext: ExecutionContext): BasicCredentials | undefined {
        const encoded = readAuthorization(executionContext, 'Basic');
        if (!encoded || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return undefined;

        const decoded = Buffer.from(encoded, 'base64').toString('utf8');
        const separator = decoded.indexOf(':');
        if (separator < 0) return undefined;

        return { username: decoded.slice(0, separator), password: decoded.slice(separator + 1) };
    }
}
