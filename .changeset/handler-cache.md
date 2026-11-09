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

**Handler cache.** Cache of the handler results in `@axisparkjs/engine`, independent of the transport and kept in the `cache` store of `@axisparkjs/store`. A handler, or a class, decorated with the new `@Cache({ ttl?, key? })` returns its cached result while it is valid instead of running again, and `@NoCache()` disables the `@Cache()` of its class. The cache is opt-in: no handler is cached without `@Cache()`. The middlewares, guards and before interceptors run on every request, also on cache hits, and the after interceptors and the result processor run as usual, so a cached result produces the same response as a fresh one. Only plain results are cached: `undefined`, the `ResultDefinition` instances (`HttpResults.File()`, streams, redirects…) and the errors are not. When the store fails, the handlers run without cache and a warning is logged at most once a minute. The new `CacheService` evicts every result of a handler (`evict(ProductController, 'find')`) with a generation counter, or one entry (`evict(ProductController, 'find', key)`). The engine has the new `CacheDefinition`, `CacheGenerator`, `CacheResolver` and `CacheProcessor`, and `ExecutionPlan` has a new `cache` field.

The HTTP plugin caches the `GET` and `HEAD` requests of the handlers with `@Cache()`, with a key made of the method, the host, the path and the sorted query string. The requests with an `Authorization` or `Cookie` header are not cached, unless the handler has a custom `key`, for example to cache per user. The new `@CacheVary('accept-language')` decorator adds request headers to the key. The new `cacheOptions` option sets the default `ttl` (60 seconds) and the `store` (`MemoryStore()` by default, or a shared store such as `RedisStore('MAIN')`), created when the plugin starts. New `caching-responses` sample.
