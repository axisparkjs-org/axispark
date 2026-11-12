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

The dependency injection `Container` and `ScopedContainer` store the providers and the scoped instances by the identity of their token instead of by its name. Two classes with the same name, such as `v1/UserService` and `v2/UserService`, resolve to their own instances, two `InjectionToken` with the same description are different tokens, and a token whose description is the name of a class no longer replaces the provider of that class. The execution plans of the engine are cached by the identity of the class too, so two controllers with the same name run their own handlers. A scoped factory that returns a falsy value (`0`, `''`, `false`) is created once per scoped container instead of on every resolution.

`@axisparkjs/di` has a new `createTokenFactory(describe)` function, which returns the same token for the same key. The tokens of named connections use it, and are exported: `kafkaConnectionToken(name)`, `kafkaProducerToken(name)` and `kafkaConsumerToken(name)` in `@axisparkjs/kafka`, `rabbitMQConnectionToken(name)` in `@axisparkjs/rabbitmq`, and `dataSourceToken(name)` and `dataRepositoryToken(repository)` in `@axisparkjs/data`. `redisConnectionToken(name)` of `@axisparkjs/redis` returns the same instance for the same name.

Breaking changes: code that creates a second `InjectionToken` with the same description to read the value of another token no longer finds it. Reuse the exported token, or the function that returns it, instead: for example `@Inject(redisConnectionToken('CACHE'))` instead of `@Inject(new InjectionToken('REDIS_CONNECTION_CACHE'))`.
