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
"@axisparkjs/schedule": minor
"@axisparkjs/security": minor
"@axisparkjs/test": minor
"@axisparkjs/websocket": minor
"@axisparkjs/websocket-socketio": minor
---

The rate limit buckets and the sliding window move from `HttpRateLimitResolver` (`@axisparkjs/http`) to `RateLimitProcessor` (`@axisparkjs/engine`), so every transport counts requests with the same algorithm. The requests are counted per transport, client and handler in a new `RateLimitStore`, with the `InMemoryRateLimitStore` used by default and replaceable with `RateLimitProcessor.registerRateLimitStore()`. `RateLimitResolver.resolve(context)` now returns the client identifier instead of the decision, and `HttpRateLimitResolver` returns `request.ip`. HTTP rate limiting keeps the same options, decorators, `429` response and `Retry-After` header. Custom resolvers registered with `RateLimitProcessor.registerRateLimit()` must return the client identifier.
