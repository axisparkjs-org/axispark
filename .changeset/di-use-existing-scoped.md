---
"@axisparkjs/cli": patch
"@axisparkjs/common": patch
"@axisparkjs/core": patch
"@axisparkjs/data": patch
"@axisparkjs/ddd": patch
"@axisparkjs/di": patch
"@axisparkjs/engine": patch
"@axisparkjs/http": patch
"@axisparkjs/http-express": patch
"@axisparkjs/http-fastify": patch
"@axisparkjs/kafka": patch
"@axisparkjs/logger": patch
"@axisparkjs/mcp": patch
"@axisparkjs/openapi": patch
"@axisparkjs/rabbitmq": patch
"@axisparkjs/redis": patch
"@axisparkjs/schedule": patch
"@axisparkjs/security": patch
"@axisparkjs/store": patch
"@axisparkjs/test": patch
"@axisparkjs/websocket": patch
"@axisparkjs/websocket-socketio": patch
---

`useExisting` providers pass the scoped container to their target, so an alias of a `Scoped` class, such as an `InjectionToken` that points to a class, resolves inside a request instead of failing with `ScopedContainerNotProvidedError`. Inside one scoped container, the alias and its target are the same instance. An alias that points to itself, or a chain of aliases that points back to one of its tokens, throws `CircularDependencyError` instead of recursing until the stack overflows.
