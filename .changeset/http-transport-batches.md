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

`HttpTransport` can send the entries in batches with the new `batch` option (`true`, or `{ size, interval }`): the entries are sent together as a JSON array when `size` entries are waiting (100 by default) or after `interval` milliseconds (1000 by default), and the call to the logger does not wait for the request. The pending entries are sent by `Logger.flush()`, called by `app.destroy()`. New `LogTransport.flush()` and `Logger.flush()`.
