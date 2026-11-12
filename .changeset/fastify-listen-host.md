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

The HTTP plugin has a new `host` option, passed to `listen()` by the Express and the Fastify adapters. Without it, both adapters listen on every network interface, as Node.js does: `::` when IPv6 is available, and `0.0.0.0` otherwise. The Fastify adapter listened only on `localhost`, so an application that used it could not be reached from outside its container. The start message of the HTTP plugin shows the address and the port returned by the server, such as `Listening on [::]:3000`, so a wrong binding is visible in the logs.

Breaking changes: applications that rely on the Fastify adapter being reachable only from `localhost` must set `host: '127.0.0.1'`.
