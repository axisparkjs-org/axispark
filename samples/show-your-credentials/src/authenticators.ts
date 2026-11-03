import { Injectable } from '@axisparkjs/di';
import { ApiKeyAuthenticator, ApiKeySource, BasicAuthenticator, BasicCredentials, safeCompare } from '@axisparkjs/security';
import { JwtAuthenticator, JWTPayload } from '@axisparkjs/security-jwt';

export interface Principal {
    id: string;
    role: 'admin' | 'reader';
    via: 'basic' | 'api-key' | 'jwt';
}

export const JWT_SECRET = process.env.JWT_SECRET ?? 'show-your-credentials-demo-secret-change-me';
export const JWT_ISSUER = 'show-your-credentials';
export const JWT_AUDIENCE = 'show-your-credentials-api';

const users = [
    { username: 'alice', password: 'alice-password', role: 'reader' as const },
    { username: 'admin', password: 'admin-password', role: 'admin' as const }
];

const clients = [
    { id: 'reporting-service', apiKey: 'reporting-key', role: 'reader' as const },
    { id: 'billing-service', apiKey: 'billing-key', role: 'admin' as const }
];

/** `Authorization: Basic <base64(username:password)>`. Only the password check is written here. */
@Injectable()
export class UserBasicAuthenticator extends BasicAuthenticator<Principal> {
    protected async validate({ username, password }: BasicCredentials): Promise<Principal | undefined> {
        const user = users.find((candidate) => candidate.username === username);
        if (!user || !safeCompare(password, user.password)) return undefined;

        return { id: user.username, role: user.role, via: 'basic' };
    }
}

/** API key in the `X-API-Key` header or in the `api_key` query parameter. */
@Injectable()
export class ClientApiKeyAuthenticator extends ApiKeyAuthenticator<Principal> {
    protected readonly source: ApiKeySource = { header: 'x-api-key', query: 'api_key' };

    protected async validate(apiKey: string): Promise<Principal | undefined> {
        const client = clients.find((candidate) => safeCompare(apiKey, candidate.apiKey));
        return client && { id: client.id, role: client.role, via: 'api-key' };
    }
}

/** JSON Web Tokens signed with HS256 in `Authorization: Bearer <token>`. */
@Injectable()
export class AppJwtAuthenticator extends JwtAuthenticator<Principal> {
    protected readonly options = {
        secret: JWT_SECRET,
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        requiredClaims: ['sub']
    };

    protected async toPrincipal(claims: JWTPayload): Promise<Principal> {
        return { id: claims.sub as string, role: claims.role === 'admin' ? 'admin' : 'reader', via: 'jwt' };
    }
}
