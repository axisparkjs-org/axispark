---
"@axisparkjs/cli": minor
"@axisparkjs/common": minor
"@axisparkjs/core": minor
"@axisparkjs/data": minor
"@axisparkjs/ddd": minor
"@axisparkjs/di": minor
"@axisparkjs/engine": minor
"@axisparkjs/http": minor
"@axisparkjs/http-express": minor
"@axisparkjs/http-fastify": minor
"@axisparkjs/kafka": minor
"@axisparkjs/logger": minor
"@axisparkjs/openapi": minor
"@axisparkjs/rabbitmq": minor
"@axisparkjs/schedule": minor
"@axisparkjs/security": minor
"@axisparkjs/security-jwt": minor
"@axisparkjs/test": minor
"@axisparkjs/websocket": minor
"@axisparkjs/websocket-socketio": minor
---

Built-in authenticators in `@axisparkjs/security`: `CredentialAuthenticator`, `BearerAuthenticator`, `BasicAuthenticator` and `ApiKeyAuthenticator`, and the `safeCompare` helper. New `@axisparkjs/security-jwt` package with `JwtAuthenticator`, which verifies JSON Web Tokens with `jose` (signature, allowed algorithms, `exp`, `nbf`, `iss` and `aud`) using a secret, a public key or a JWKS URI.
