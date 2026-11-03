import { Injectable } from '@axisparkjs/di';
import { BearerAuthenticator, safeCompare } from '@axisparkjs/security';

export interface Principal {
    id: string;
    role: 'admin' | 'reader';
}

/**
 * Demo authenticator for `Authorization: Bearer admin-token`. `BearerAuthenticator` reads and parses the header, so
 * only the token validation is written here. Replace it with your identity provider, or use `JwtAuthenticator` from
 * `@axisparkjs/security-jwt` to verify JSON Web Tokens.
 */
@Injectable()
export class DemoAuthenticator extends BearerAuthenticator<Principal> {
    protected async validate(token: string): Promise<Principal | undefined> {
        if (!safeCompare(token, 'admin-token')) return undefined;

        return { id: 'admin', role: 'admin' };
    }
}
