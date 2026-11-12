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

A log transport that fails, such as an `HttpTransport` or a `WebhookTransport` whose endpoint is down, no longer rejects `logger.info()`, `warn()`, `error()`, `debug()`, `trace()` and `fatal()`. `Logger.log()` waits for every transport with `Promise.allSettled()`, so the other transports still receive the entry and the code that logs, awaited or not, is never broken by a log line. The failure of a transport is written to `process.stderr` at most once per transport every minute, or passed to the new `onError(error, entry)` option of the transport. The new `failOnError` option of the transports keeps the rejection for the logs that must stop the operation when they can not be written, such as audit logs.

`HttpTransport` and `WebhookTransport` have a new `timeout` option, 5 seconds by default, so a log endpoint that does not answer can not block the application.
