import { ExecutionContext } from '@axisparkjs/engine';

/**
 * Part of the HTTP execution context read by the built-in HTTP authenticators.
 *
 * It is a structural type, so `@axisparkjs/security` does not depend on `@axisparkjs/http`. The `HttpContext` of the
 * HTTP plugin matches it.
 */
export interface HttpCredentialContext extends ExecutionContext {
    request: {
        getHeader(name: string): string | string[] | undefined;
        query?: Readonly<Record<string, string | string[] | undefined>>;
    };
}

/** Returns the first value of a header or query parameter, or `undefined` when it is missing or empty. */
export function firstValue(value: string | string[] | undefined): string | undefined {
    const first = Array.isArray(value) ? value[0] : value;
    return first === undefined || first === '' ? undefined : first;
}

/** Returns the request of an HTTP execution context, or `undefined` for other contexts. */
export function httpRequest(executionContext: ExecutionContext): HttpCredentialContext['request'] | undefined {
    const request = (executionContext as Partial<HttpCredentialContext>).request;
    return typeof request?.getHeader === 'function' ? request : undefined;
}

/**
 * Reads the credentials of the `Authorization` header for an authentication scheme, such as `Bearer` or `Basic`.
 * The scheme is compared case-insensitively.
 * @returns The credentials after the scheme, or `undefined` when the header is missing or uses another scheme.
 */
export function readAuthorization(executionContext: ExecutionContext, scheme: string): string | undefined {
    const authorization = firstValue(httpRequest(executionContext)?.getHeader('authorization'));
    if (!authorization) return undefined;

    const match = /^(\S+)[ \t]+(\S+)[ \t]*$/.exec(authorization.trim());
    if (!match || match[1].toLowerCase() !== scheme.toLowerCase()) return undefined;

    return match[2];
}
