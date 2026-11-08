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
"@axisparkjs/mcp": minor
"@axisparkjs/openapi": minor
"@axisparkjs/rabbitmq": minor
"@axisparkjs/redis": minor
"@axisparkjs/schedule": minor
"@axisparkjs/security": minor
"@axisparkjs/store": minor
"@axisparkjs/test": minor
"@axisparkjs/websocket": minor
"@axisparkjs/websocket-socketio": minor
---

New `@axisparkjs/store` package with pluggable stores. Every feature that keeps state uses an in-memory store by default and accepts a `StoreProvider`, a function that the plugin calls with the kind of store it needs (`'rate-limit'`, `'lock'` or `'cache'`) when it starts. `MemoryStore()` provides `InMemoryRateLimitStore`, `InMemoryLockStore` and `InMemoryCacheStore`, and `RedisStore(connection, { prefix })` from `@axisparkjs/redis` provides `RedisRateLimitStore`, `RedisLockStore` and `RedisCacheStore`, which share the state between every instance connected to the same Redis. The HTTP rate limits accept `rateLimitOptions.store`, and the `SchedulePlugin` accepts a `lockStore` option, created with the new `SchedulePluginOptionsFactory`, for the new exclusive jobs: `@Cron({ value, exclusive: true })` runs each occurrence on only one instance, and `exclusive: { mode: 'no-overlap' }` never runs the job on two instances at the same time.

Breaking changes: `RateLimitStore`, `RateLimitDecision` and `InMemoryRateLimitStore` move from `@axisparkjs/engine` to `@axisparkjs/store`, with no re-exports, and `HttpRateLimitResolver` no longer re-exports `RateLimitDecision`. `RateLimitStore.consume()` receives a `RateLimitPolicy` (`ttl` and `limit`), which `RateLimitDefinition` implements. `RateLimitProcessor.registerRateLimitStore(store)` requires the store and has no in-memory default: register custom stores with `rateLimitOptions: { store: () => new MyStore() }` instead of calling it.
