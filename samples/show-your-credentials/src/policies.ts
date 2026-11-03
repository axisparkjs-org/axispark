import { Injectable } from '@axisparkjs/di';
import { AuthorizationDecision, AuthorizationPolicy, SecurityContext } from '@axisparkjs/security';
import { Principal } from './authenticators';

@Injectable()
export class AdminPolicy extends AuthorizationPolicy {
    async authorize(context: SecurityContext<Principal>): Promise<AuthorizationDecision> {
        return context.data?.role === 'admin'
            ? { policy: AdminPolicy, authorized: true }
            : { policy: AdminPolicy, authorized: false, reason: 'An administrator role is required' };
    }
}
