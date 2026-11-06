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
"@axisparkjs/test": minor
"@axisparkjs/websocket": minor
"@axisparkjs/websocket-socketio": minor
---

New `@axisparkjs/redis` package with the `RedisPlugin`, which manages named Redis connections based on `node-redis`. The connections are configured with a name, a URL and the client options, injected with `@InjectRedisConnection(name)` or retrieved from the `RedisConnectionManager`, and closed when the application stops. The `ready`, `reconnecting`, `error` and `end` events are logged, and connection errors never stop the process. A `redis:<name>` health check is registered for each connection unless `healthChecks` is `false`, and `failOnConnectError` makes the application fail to start when a connection cannot be established.
