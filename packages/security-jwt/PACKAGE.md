# `@axisparkjs/security-jwt`

JSON Web Token authentication for `@axisparkjs/security`. It provides `JwtAuthenticator`, a `BearerAuthenticator` that verifies the token with [`jose`](https://github.com/panva/jose).

The complete guide is in the [Security Plugin documentation](https://axisparkjs.com/docs/security-plugin/built-in-authenticators).

## What the package does

- Reads the token of the `Authorization: Bearer <token>` header of HTTP requests.
- Verifies the signature with a shared secret (HS algorithms), a public key (RS, PS, ES and EdDSA algorithms) or a remote JSON Web Key Set.
- Rejects tokens with a not allowed algorithm, an invalid signature, or invalid `exp`, `nbf`, `iss` or `aud` claims.
- Maps the verified claims to the principal stored in `SecurityContext.data`.

## Install and use

```bash
npm install @axisparkjs/security @axisparkjs/security-jwt
```

Extend `JwtAuthenticator`, set its `options` and, optionally, map the claims to your principal with `toPrincipal`. By default the claims are the principal:

```ts
import { Injectable } from '@axisparkjs/di';
import { JwtAuthenticator, JWTPayload } from '@axisparkjs/security-jwt';

export interface Principal {
    id: string;
    role: 'admin' | 'reader';
}

@Injectable()
export class AppJwtAuthenticator extends JwtAuthenticator<Principal> {
    protected readonly options = {
        secret: process.env.JWT_SECRET as string,
        algorithms: ['HS256'],
        issuer: 'my-app',
        audience: 'my-api'
    };

    protected async toPrincipal(claims: JWTPayload): Promise<Principal> {
        return { id: claims.sub as string, role: claims.role as Principal['role'] };
    }
}
```

Register it like any other authenticator:

```ts
app.use(SecurityPlugin, SecurityPluginOptionsFactory.create({ authenticator: { strategy: 'selected', selected: [AppJwtAuthenticator] } }));
```

An invalid, expired or malformed token returns `undefined`, so the next authenticator can run and the guards throw `AuthenticationError` for `@Secured()` handlers. An invalid configuration, such as missing `algorithms` or no key, throws an error.

## Options

| Option | Description |
| --- | --- |
| `secret` | Shared secret for the HS256, HS384 and HS512 algorithms. |
| `publicKey` | PEM-encoded SPKI public key or certificate, `KeyObject` or `CryptoKey`, for the RS, PS, ES and EdDSA algorithms. |
| `jwksUri` | URL of a JSON Web Key Set. Keys are downloaded on demand, cached and selected by the `kid` of the token. |
| `algorithms` | Required. Allowed signature algorithms, such as `['HS256']` or `['RS256']`. `none` is not allowed. |
| `issuer` | Expected `iss` claim. |
| `audience` | Expected `aud` claim. |
| `clockTolerance` | Tolerance for `exp` and `nbf`, in seconds or as a time span such as `'30s'`. |
| `maxTokenAge` | Maximum age of the token from its `iat` claim, such as `'1h'`. |
| `requiredClaims` | Claims the token must contain, such as `['sub']`. |

Set exactly one of `secret`, `publicKey` or `jwksUri`. Signing tokens (for example, in a login endpoint) is left to the application; you can use `SignJWT` from `jose`.
