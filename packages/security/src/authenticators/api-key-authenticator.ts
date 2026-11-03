import { ExecutionContext, ExecutionTransport } from '@axisparkjs/engine';
import { CredentialAuthenticator } from './credential-authenticator';
import { firstValue, httpRequest } from './http-credentials';

/** Where an {@link ApiKeyAuthenticator} reads the API key. When both are set, the header is read first. */
export interface ApiKeySource {
    /** Header name, case-insensitive. */
    header?: string;
    /** Query parameter name. */
    query?: string;
}

/**
 * Authenticator for HTTP requests that send an API key in a header (`X-API-Key` by default) or a query parameter.
 *
 * Override `source` to change where the key is read, and implement {@link validate} to find the client of the key.
 * Compare keys with `safeCompare`, never with `===`.
 *
 * ```ts
 * @Injectable()
 * export class ApiKeyAuth extends ApiKeyAuthenticator<Client> {
 *     protected readonly source = { header: 'x-api-key' };
 *
 *     constructor(private readonly clients: ClientService) {
 *         super();
 *     }
 *
 *     protected async validate(apiKey: string): Promise<Client | undefined> {
 *         return this.clients.findByApiKey(apiKey);
 *     }
 * }
 * ```
 * @template TPrincipal Application-defined principal returned for a valid key.
 */
export abstract class ApiKeyAuthenticator<TPrincipal = unknown> extends CredentialAuthenticator<string, TPrincipal> {
    static readonly transports: readonly ExecutionTransport[] = [ExecutionTransport.Http];

    /** Where the API key is read. Defaults to the `X-API-Key` header. */
    protected readonly source: ApiKeySource = { header: 'x-api-key' };

    /** Reads the API key from the configured header or query parameter. */
    protected extract(executionContext: ExecutionContext): string | undefined {
        const request = httpRequest(executionContext);
        if (!request) return undefined;

        const { header, query } = this.source;
        return (header ? firstValue(request.getHeader(header.toLowerCase())) : undefined) ?? (query ? firstValue(request.query?.[query]) : undefined);
    }
}
