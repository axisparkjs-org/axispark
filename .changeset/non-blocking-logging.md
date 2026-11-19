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

New `logger.nonBlocking`, with the level methods of the logger that do not wait for the transports and never reject, while the failures of the transports are still reported. The framework uses it in the hot paths: the HTTP request, response and error logs, the `CacheProcessor` logs, the errors while sending an HTTP response, the unexpected errors of the MCP server and the logs of the scheduler, so the latency of the transports is not added to the requests. Before, some of these calls were awaited, and others were not awaited nor handled, so a transport with `failOnError` caused an unhandled rejection.
