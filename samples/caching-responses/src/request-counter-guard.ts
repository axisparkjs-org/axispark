import { Check, Context, ExecutionTransport, Guard } from '@axisparkjs/engine';
import { ForbiddenError, HttpContext } from '@axisparkjs/http';
import { catalog } from './catalog';

/** A global guard: it runs on every request, also when the result comes from the cache. */
@Guard({ transport: ExecutionTransport.Http, global: true })
export class RequestCounterGuard {
    @Check()
    async check(@Context() context: HttpContext) {
        catalog.guardChecks++;
        if (context.request.getHeader('x-blocked') === 'true') throw new ForbiddenError('Blocked client');
    }
}
