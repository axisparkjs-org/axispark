import { Check, Context, ExecutionTransport, Guard, StepPriority } from '@axisparkjs/engine';
import { HttpContext } from '../../types';
import { NotFoundError } from '../errors';

/** A guard that validates a controller's host against the current HTTP request. */
@Guard({ transport: ExecutionTransport.Http, priority: StepPriority.Critical })
export class HostGuard {
    /** Ensures that the request host matches the selected controller's host definition. */
    @Check()
    public async failedCheckHost(@Context() context: HttpContext): Promise<void> {
        if (context.host && !context.host.isHostAccepted()) {
            throw new NotFoundError(`Route not found for ${context.request.method} ${context.request.path}`);
        }
    }
}
