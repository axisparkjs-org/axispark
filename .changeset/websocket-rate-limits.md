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

**WebSocket rate limits.** Rate limits for the WebSocket events. The WebSocket plugin has new `rateLimit` and `rateLimitOptions` options (`ttl`, `limit`, `message`, `by` and `store`), as the HTTP plugin: with `rateLimit: true`, the new `WsRateLimitGuard` counts the events of each client per event handler, and the events beyond the limit are rejected with the new `WebSocketRateLimitExceededError` before the handler is invoked. The client receives it through the acknowledgement: `{ "error": "Too many requests. Please try again later.", "status": 429, "retryAfterMs": 750 }`. `@RateLimit()` and `@NoRateLimit()` work on WebSocket gateways and events as on HTTP controllers. The new `WsRateLimitResolver` identifies the clients with `rateLimitOptions.by`: `'address'` (default), so reconnecting does not reset the limits, `'connection'`, or a function, for example to count the events per authenticated user. The rate limits use the store of `rateLimitOptions.store` (`MemoryStore()` by default), created when the plugin starts, so the HTTP and WebSocket plugins can use different stores. `WebSocketError` has a new `details` getter, whose fields are added to the acknowledgement of the error.

`WebSocketConnection` has a new `remoteAddress` property with the address of the client. The WebSocket plugin has a new `trustProxy` option, with the same values as the HTTP plugin, to resolve it from the `X-Forwarded-For` header of the handshake behind trusted proxies. It defaults to `false`, or to the `trustProxy` of the HTTP plugin with `useHttpPluginServer`. Breaking change for custom WebSocket adapters: their connections must implement `remoteAddress`.
