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

The plugins that do not depend on each other run `onRegister` and `onStart` at the same time, level by level of the dependency graph, so independent connections (Redis, Kafka, RabbitMQ) no longer start one after the other. `onStop` still runs one plugin at a time in the reverse of the dependency order, because a plugin can use the connections of another one without declaring it, such as the scheduler with a `RedisStore`. New `pluginLifecycle` option of the application: `'sequential'` keeps running them one by one in dependency order.
