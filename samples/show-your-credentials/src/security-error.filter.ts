import { Catch, ExecutionTransport, Filter, FilteredError, StepPriority } from '@axisparkjs/engine';
import { HttpResults } from '@axisparkjs/http';
import { AuthenticationError, SecurityError } from '@axisparkjs/security';

@Filter({ global: true, transport: ExecutionTransport.Http, priority: StepPriority.Critical })
export class SecurityErrorHttpFilter {
    @Catch(SecurityError)
    map(@FilteredError() error: SecurityError) {
        return error instanceof AuthenticationError
            ? HttpResults.Unauthorized(error.response, error.options)
            : HttpResults.Forbidden(error.response, error.options);
    }
}
