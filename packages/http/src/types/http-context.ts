import { HttpRequest } from './http-request';
import { HttpResponse } from './http-response';
import { HttpSession } from './http-session';
import { VersionDefinition } from '../version/version-definition';
import { HostDefinition } from '../host/host-definition';
import { ExecutionContext } from '@axisparkjs/engine';

/**
 * Represents the context of an HTTP request, including request, response, session, host, and version information. Extends the ExecutionContext from the engine module.
 */
export interface HttpContext extends ExecutionContext {
    request: HttpRequest;
    response: HttpResponse;
    session: HttpSession | undefined;
    host: HostDefinition | undefined;
    version: VersionDefinition | undefined;
}
