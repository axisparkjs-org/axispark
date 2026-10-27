import { Context } from '@axisparkjs/engine';
import { HttpContext } from '../../types';
import { BadRequestError } from '../errors';
import { Guard } from '@axisparkjs/engine';
import { Check } from '@axisparkjs/engine';
import { ExecutionTransport } from '@axisparkjs/engine';
import { StepPriority } from '@axisparkjs/engine';

/**
 * A guard for validating versions.
 */
@Guard({ transport: ExecutionTransport.Http, priority: StepPriority.Critical })
export class VersionGuard {
    /**
     * Checks if the requested version is accepted.
     * @param context The HTTP context.
     * @returns A promise resolving to a boolean indicating if the version is accepted.
     */
    @Check()
    public async failedCheckVersion(@Context() context: HttpContext) {
        if (context.version && !context.version.isVersionAccepted())
            throw new BadRequestError(`Invalid version requested for ${context.request.method} ${context.request.path}`);
    }
}
