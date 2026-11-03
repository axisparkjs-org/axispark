import type { KeyObject } from 'node:crypto';

/**
 * Options of a {@link JwtAuthenticator}. Set exactly one of `secret`, `publicKey` or `jwksUri`.
 */
export interface JwtAuthenticatorOptions {
    /** Shared secret for the HS256, HS384 and HS512 algorithms. */
    secret?: string | Uint8Array;
    /**
     * Public key for the RS, PS, ES and EdDSA algorithms: a PEM-encoded SPKI public key or certificate, a `KeyObject`
     * or a `CryptoKey`.
     */
    publicKey?: string | KeyObject | CryptoKey;
    /** URL of a JSON Web Key Set. Keys are downloaded on demand, cached and selected by the `kid` of the token. */
    jwksUri?: string;
    /**
     * Algorithms allowed for the token signature, such as `['HS256']` or `['RS256', 'ES256']`. Required, so tokens
     * signed with an unexpected algorithm (including `none`) are rejected.
     */
    algorithms: string[];
    /** Expected `iss` claim. A token from another issuer is rejected. */
    issuer?: string | string[];
    /** Expected `aud` claim. A token for another audience is rejected. */
    audience?: string | string[];
    /** Tolerance for the `exp` and `nbf` claims, in seconds or as a time span such as `'30s'`. */
    clockTolerance?: number | string;
    /** Maximum age of the token, measured from its `iat` claim, in seconds or as a time span such as `'1h'`. */
    maxTokenAge?: number | string;
    /** Claims the token must contain, such as `['sub']`. */
    requiredClaims?: string[];
}
