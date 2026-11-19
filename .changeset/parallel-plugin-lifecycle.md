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

The plugins that do not depend on each other run `onRegister` and `onStart` at the same time, level by level of the dependency graph, so independent connections (Redis, Kafka, RabbitMQ) no longer start one after the other. `onStop` still runs one plugin at a time in the reverse of the dependency order, because a plugin can use the connections of another one without declaring it, such as the scheduler with a `RedisStore`. New `pluginLifecycle` option of the application: `'sequential'` keeps running them one by one in dependency order.
