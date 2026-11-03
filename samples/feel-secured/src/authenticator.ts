import { Injectable } from '@axisparkjs/di';
import { BearerAuthenticator } from '@axisparkjs/security';

export interface Principal {
    id: string;
    role: 'reader' | 'admin';
    active: boolean;
}

const principals = new Map<string, Principal>([
    ['alice-token', { id: 'alice', role: 'reader', active: true }],
    ['admin-token', { id: 'admin', role: 'admin', active: true }],
    ['disabled-token', { id: 'disabled', role: 'reader', active: false }]
]);

/** Opaque Bearer tokens. `BearerAuthenticator` reads `Authorization: Bearer <token>`, so only the lookup is written here. */
@Injectable()
export class TokenAuthenticator extends BearerAuthenticator<Principal> {
    protected async validate(token: string): Promise<Principal | undefined> {
        return principals.get(token);
    }
}
