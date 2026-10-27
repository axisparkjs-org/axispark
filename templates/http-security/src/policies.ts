import { Injectable } from '@axisparkjs/di';
import { AuthorizationDecision, AuthorizationPolicy, SecurityContext } from '@axisparkjs/security';
import { Principal } from './authenticator';

@Injectable()
export class AdminPolicy extends AuthorizationPolicy {
    async authorize(context: SecurityContext<Principal>): Promise<AuthorizationDecision> {
        const authorized = context.data?.role === 'admin';

        return authorized ? { policy: AdminPolicy, authorized: true } : { policy: AdminPolicy, authorized: false, reason: 'An administrator role is required' };
    }
}
