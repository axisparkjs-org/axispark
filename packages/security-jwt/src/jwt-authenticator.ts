import { createPublicKey, createSecretKey, KeyObject } from 'node:crypto';
import { ExecutionContext } from '@axisparkjs/engine';
import { BearerAuthenticator } from '@axisparkjs/security';
import { createRemoteJWKSet, errors, JWTPayload, jwtVerify, JWTVerifyGetKey } from 'jose';
import { JwtAuthenticatorOptions } from './jwt-authenticator-options';

type VerificationKey = KeyObject | CryptoKey | JWTVerifyGetKey;

/**
 * Authenticator for HTTP requests with a JSON Web Token in an `Authorization: Bearer <token>` header.
 *
 * The token is verified with [`jose`](https://github.com/panva/jose): signature, allowed algorithm, `exp`, `nbf` and,
 * when configured, `iss` and `aud`. An invalid, expired or malformed token returns `undefined`, so the next
 * authenticator can run and the guards throw `AuthenticationError` for secured executions.
 *
 * Set the options with the `options` property, and override {@link toPrincipal} to map the verified claims to the
 * principal. By default the claims are the principal.
 *
 * ```ts
 * @Injectable()
 * export class AppJwtAuthenticator extends JwtAuthenticator<Principal> {
 *     protected readonly options = {
 *         secret: process.env.JWT_SECRET!,
 *         algorithms: ['HS256'],
 *         issuer: 'my-app'
 *     };
 *
 *     protected async toPrincipal(claims: JWTPayload): Promise<Principal> {
 *         return { id: claims.sub!, role: claims.role as Principal['role'] };
 *     }
 * }
 * ```
 * @template TPrincipal Application-defined principal returned for a valid token.
 * @template TClaims Claims of the verified token.
 */
export abstract class JwtAuthenticator<TPrincipal = JWTPayload, TClaims extends JWTPayload = JWTPayload> extends BearerAuthenticator<TPrincipal> {
    /** Verification options of the authenticator. */
    protected abstract readonly options: JwtAuthenticatorOptions;

    private key?: VerificationKey;

    /**
     * Verifies the token and maps its claims with {@link toPrincipal}.
     * @returns The principal, or `undefined` when the token is not valid.
     * @throws Error when the options are not valid, for example without algorithms or without a key.
     */
    protected async validate(token: string, executionContext: ExecutionContext): Promise<TPrincipal | undefined> {
        const key = this.verificationKey();
        const { algorithms, issuer, audience, clockTolerance, maxTokenAge, requiredClaims } = this.options;

        let claims: TClaims;
        try {
            const options = { algorithms, issuer, audience, clockTolerance, maxTokenAge, requiredClaims };
            const { payload } = typeof key === 'function' ? await jwtVerify<TClaims>(token, key, options) : await jwtVerify<TClaims>(token, key, options);
            claims = payload;
        } catch (error) {
            if (error instanceof errors.JOSEError) return undefined;
            throw error;
        }

        return (await this.toPrincipal(claims, executionContext)) || undefined;
    }

    /**
     * Maps the verified claims to the principal stored in `SecurityContext.data`. Return `undefined` to reject the
     * token, for example when its subject no longer exists.
     * @returns The claims by default.
     */
    protected async toPrincipal(claims: TClaims, _executionContext: ExecutionContext): Promise<TPrincipal | undefined> {
        return claims as unknown as TPrincipal;
    }

    /** Validates the options and creates the verification key once. */
    private verificationKey(): VerificationKey {
        if (this.key) return this.key;

        const { secret, publicKey, jwksUri, algorithms } = this.options ?? {};
        const name = this.constructor.name;

        if (!Array.isArray(algorithms) || algorithms.length === 0) throw new Error(`${name}: 'algorithms' must contain at least one algorithm.`);
        if (algorithms.some((algorithm) => algorithm.toLowerCase() === 'none')) throw new Error(`${name}: the 'none' algorithm is not allowed.`);

        const keys = [secret, publicKey, jwksUri].filter((value) => value !== undefined && value !== '');
        if (keys.length !== 1) throw new Error(`${name}: set exactly one of 'secret', 'publicKey' or 'jwksUri'.`);

        if (secret !== undefined) {
            this.key = createSecretKey(typeof secret === 'string' ? Buffer.from(secret, 'utf8') : secret);
        } else if (publicKey !== undefined) {
            this.key = typeof publicKey === 'string' ? createPublicKey(publicKey) : publicKey;
        } else {
            this.key = createRemoteJWKSet(new URL(jwksUri as string));
        }

        return this.key;
    }
}
