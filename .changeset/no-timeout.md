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

`@NoTimeout()` disables the timeout of a handler instead of making the request time out immediately. It defines `{ disabled: true }` in the timeout metadata instead of a time of `-1`, and `TimeoutGenerator` returns no timeout for a disabled metadata or a negative time. The method metadata still takes precedence over the class metadata, so `@NoTimeout()` on a method disables a `@Timeout()` of its class and the default timeout of the transport, and `@NoTimeout()` on a class disables the timeout of all its handlers unless a method has its own `@Timeout()`. `@Timeout(time)` throws an error when the time is not a number greater than `0`, so the mistake is visible at startup. `TimeoutMetadata.time` is now optional.
