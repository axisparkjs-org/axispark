# `@axisparkjs/security`

Transport-neutral authentication and authorization primitives for AxiSpark. The package provides the execution pipeline, dependency-injection integration, security context, and error types. Your application supplies the credential authenticators and authorization policies, so the package does not dictate token formats, user or role models, sessions, persistence, or policy language.

The complete guide is in the [Security Plugin documentation](https://axisparkjs.com/docs/category/security-plugin).

## What the package does

- Runs injectable authenticators and stores the first successful identity value in the execution context.
- Marks class and method handlers as secured with `@Secured()`.
- Resolves and evaluates authorization policies, combining all decisions with logical AND.
- Adds global middleware and guards to the AxiSpark pipeline for every supported execution transport.
- Emits framework-neutral authentication and authorization errors that an adapter or application can map to transport responses.

It does not implement a built-in credential scheme. Implement a subclass of `Authenticator` for bearer tokens, API keys, sessions, mutual TLS identities, or another scheme. Implement `AuthorizationPolicy` subclasses for application rules such as roles, permissions, ownership, tenant isolation, or resource state.

## Install and register

Install this package and the relevant AxiSpark transport packages, then register the security plugin once in the application:

```ts
import { AxiSparkFactory } from '@axisparkjs/core';
import { HttpPlugin } from '@axisparkjs/http';
import { HttpPluginOptionsFactory } from '@axisparkjs/http-express';
import { SecurityPlugin, SecurityPluginOptionsFactory } from '@axisparkjs/security';
import { BearerAuthenticator } from './auth/bearer-authenticator';

const app = AxiSparkFactory.create({ name: 'Example', basePath: __dirname });

app.use(HttpPlugin, HttpPluginOptionsFactory.create({ basePath: '/api', port: 3000 }));
app.use(
    SecurityPlugin,
    SecurityPluginOptionsFactory.create({
        authenticator: { strategy: 'selected', selected: [BearerAuthenticator] }
    })
);
```

Use the options factory to supply `SecurityPlugin` and default configuration. The default strategy is `all`; applications generally get the most predictable behavior by specifying `selected` and listing the authenticators that should run.

## Implement authentication

Extend `Authenticator`, mark the class injectable, and return an application-defined principal or claims object when credentials are valid. Return a falsy value when this authenticator cannot authenticate the execution. Authenticator classes are resolved through the application's dependency injection container, so constructor dependencies are supported.

```ts
import { Injectable } from '@axisparkjs/di';
import { ExecutionContext } from '@axisparkjs/engine';
import { HttpContext } from '@axisparkjs/http';
import { Authenticator } from '@axisparkjs/security';

export interface Principal {
    id: string;
    roles: string[];
}

@Injectable()
export class BearerAuthenticator extends Authenticator {
    async authenticate(context: ExecutionContext): Promise<Principal | undefined> {
        const request = (context as HttpContext).request;
        const authorization = request.getHeader('authorization');
        if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) return undefined;

        return this.tokenService.verify(authorization.slice('Bearer '.length));
    }
}
```

`Authenticator.transports` defaults to `[ExecutionTransport.All]`. Override the static property to limit an implementation to specific transports. The top-level `authenticator.transports` option can independently disable authentication middleware for selected transports.

If multiple authenticators are enabled, they run in order. The first truthy result is stored as `SecurityContext.data`; the engine sets `authenticated` and `authenticationMethod`, then stops. A result of `undefined`, `null`, `false`, `0`, or `''` is treated as failure. This also means public endpoints may still have an optional identity attached when credentials are valid.

## Define authorization policies

Extend `AuthorizationPolicy` and return a decision that names the policy. Denials must include a reason. Policies can use injected services and any values in the generic `SecurityContext<T>` identity data.

```ts
import { Injectable } from '@axisparkjs/di';
import {
    AuthorizationDecision,
    AuthorizationPolicy,
    SecurityContext
} from '@axisparkjs/security';
import { Principal } from './principal';

@Injectable()
export class AdminPolicy extends AuthorizationPolicy {
    async authorize(context: SecurityContext<Principal>): Promise<AuthorizationDecision> {
        const authorized = context.data?.roles.includes('admin') === true;
        return authorized
            ? { policy: AdminPolicy, authorized: true }
            : { policy: AdminPolicy, authorized: false, reason: 'An administrator role is required' };
    }
}
```

The policy receives the full engine `SecurityContext`, including the transport execution context, the identity returned by authentication, and the authorization state. Cast or narrow the execution context to a transport-specific context when a rule needs request parameters or message metadata.

## Protect a class or method

`@Secured({ policies })` works on a class or handler method. A class-level policy applies to its handlers; method-level policies apply to that method. When both are declared, class policies run first and method policies run second. All policies execute, even after a denial, and every policy must allow the request.

```ts
@Controller('/admin')
@Secured({ policies: [ActivePrincipalPolicy] })
export class AdminController {
    @Get('/reports')
    @Secured({ policies: [AdminPolicy] })
    listReports() {
        return this.reportService.list();
    }

    @Get('/profile')
    @Secured({ policies: [] })
    profile() {
        return this.profileService.get();
    }
}
```

`listReports` requires authentication, an active principal, and admin access. `profile` requires authentication and the class-level active-principal policy. An empty policy list is useful for authentication-only protection. Without `@Secured()`, the guards do not require an identity or policy approval; the authentication middleware can still attach an identity for optional-authentication use cases.

## Pipeline and security context

The package registers global steps for all execution transports. Their priorities make the sequence:

1. **Authentication middleware** selects and runs authenticators (when enabled for the transport), and identifies whether the target is secured.
2. **Authorization middleware** evaluates class and method policies and records each decision.
3. **Authentication guard** rejects a secured target without a truthy authentication result.
4. **Authorization guard** rejects a secured target if any policy denied it.
5. The handler runs only after the guards allow the execution.

The ordering depends on AxiSpark's descending step priority: authentication is `Normal`; authorization is `Low`. The authentication guard therefore runs before the authorization guard.

`SecurityContext<T>` extends AxiSpark's `ExecutionContext`. The authentication engine sets `securedMethod` when `@Secured()` metadata is found. On success it sets `authenticated`, `authenticationMethod`, and `data`. The authorization engine sets `authorized` and `authorizationDecisions`; a target with no policies has no policy denial. `T` describes the application-owned shape stored in `data`, such as a principal, token claims, or a service identity. It is not prescribed by this package.

## Configure authenticator selection

```ts
SecurityPluginOptionsFactory.create({
    authenticator: {
        strategy: 'selected',
        selected: [BearerAuthenticator, ApiKeyAuthenticator],
        transports: [ExecutionTransport.Http]
    }
});
```

| Option | Meaning |
| --- | --- |
| `strategy: 'selected'` | Run only the classes in `selected`, in array order. |
| `strategy: 'all'` | Discover injectable classes registered in the application that extend `Authenticator`. |
| `selected` | Authenticator classes used by the selected strategy. Each must be resolvable by dependency injection. |
| `transports` | Transport-level switch for the authentication middleware. Omitted means all transports. |
| `Authenticator.transports` | Per-authenticator transport filter. Omitted on a subclass means all transports. |

`all` can be useful for plugin-driven applications, but any injectable authenticator subclass discovered by the registry can participate. Use `selected` when the application should control precisely which credential mechanisms run.

Include every protected transport in the middleware-level `transports` list. The authentication engine also discovers `@Secured()` metadata and sets the flag that the guards use to enforce security. If the authentication middleware is disabled for a transport, that discovery does not run there, so the security guards will not enforce `@Secured()` on that transport.

## Handle security errors

The guards throw `AuthenticationError` for missing/invalid authentication on a secured target and `AuthorizationError` when policies deny access. `AuthorizationError.causes` contains the policy decisions, including denial reasons. Both inherit from `SecurityError`, which exposes `response`, `status`, and optional `options` (`cause` and `description`).

The package does not convert these errors to HTTP or another protocol. Add an application error filter or adapter integration. For example, an HTTP filter can map `AuthenticationError` to 401 and `AuthorizationError` to 403. The `SecurityError.status` values (`1` and `2`) are package category codes, not HTTP status codes. See the runnable [feel-secured sample](../../samples/feel-secured/src/security-error.filter.ts).

## Public API

The package root exports:

- `Authenticator` and `AuthenticatorType`
- `AuthorizationPolicy` and `AuthorizationDecision`
- `SecurityContext<T>`
- `Secured` and `SecuredMetadata`
- `SecurityPlugin`, `SecurityPluginOptions`, and `SecurityPluginOptionsFactory`
- `AuthenticationEngine` and `AuthorizationEngine`
- `AuthenticationError`, `AuthorizationError`, and `SecurityError`
- Security middleware, guards, and DI tokens
