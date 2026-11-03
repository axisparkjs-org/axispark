import { ExecutionContext, ExecutionTransport } from '@axisparkjs/engine';
import { CredentialAuthenticator } from './credential-authenticator';
import { readAuthorization } from './http-credentials';

/**
 * Authenticator for HTTP requests with an `Authorization: Bearer <token>` header. The scheme is case-insensitive.
 *
 * Implement {@link validate} to turn the token into a principal:
 *
 * ```ts
 * @Injectable()
 * export class TokenAuthenticator extends BearerAuthenticator<Principal> {
 *     constructor(private readonly tokens: TokenService) {
 *         super();
 *     }
 *
 *     protected async validate(token: string): Promise<Principal | undefined> {
 *         return this.tokens.findPrincipal(token);
 *     }
 * }
 * ```
 * @template TPrincipal Application-defined principal returned for a valid token.
 */
export abstract class BearerAuthenticator<TPrincipal = unknown> extends CredentialAuthenticator<string, TPrincipal> {
    static readonly transports: readonly ExecutionTransport[] = [ExecutionTransport.Http];

    /** Reads the token of the `Authorization: Bearer <token>` header. */
    protected extract(executionContext: ExecutionContext): string | undefined {
        return readAuthorization(executionContext, 'Bearer');
    }
}
