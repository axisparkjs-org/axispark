import { Injectable } from '@axisparkjs/di';
import { ExecutionContext } from '@axisparkjs/engine';
import { HttpContext } from '@axisparkjs/http';
import { Authenticator } from '@axisparkjs/security';

export interface Principal {
    id: string;
    role: 'admin' | 'reader';
}

@Injectable()
export class DemoAuthenticator extends Authenticator {
    async authenticate(executionContext: ExecutionContext): Promise<Principal | undefined> {
        const context = executionContext as HttpContext;
        const authorization = context.request.getHeader('authorization');

        if (authorization !== 'Demo admin') return undefined;

        return { id: 'admin', role: 'admin' };
    }
}
