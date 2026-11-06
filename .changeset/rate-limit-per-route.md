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
"@axisparkjs/schedule": patch
"@axisparkjs/security": patch
"@axisparkjs/test": patch
"@axisparkjs/websocket": patch
"@axisparkjs/websocket-socketio": patch
---

The HTTP rate limit is applied per route instead of per requested URL: the bucket key is built with the client IP, the HTTP method and the handler, so changing a route parameter (`/users/1`, `/users/2`…) or the query string no longer bypasses the limit. `FastifyHttpRequest.path` returns the path without the query string, as `ExpressHttpRequest.path` does.
