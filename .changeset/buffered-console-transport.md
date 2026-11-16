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

`ConsoleTransport` writes to the standard output through a buffered asynchronous stream (`sonic-boom`, already installed with Fastify) instead of `console.log`, which is synchronous with files and pipes and blocked the event loop under load. The lines still in the buffer are written when the process exits, and when the application is destroyed. New `buffered` option (`false` keeps `console.log`), new `LogTransport.flush()` and `Logger.flush()`, called by `app.destroy()`.
