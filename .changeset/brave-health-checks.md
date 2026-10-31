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
"@axisparkjs/openapi": minor
"@axisparkjs/rabbitmq": minor
"@axisparkjs/schedule": minor
"@axisparkjs/security": minor
"@axisparkjs/test": minor
"@axisparkjs/websocket": minor
"@axisparkjs/websocket-socketio": minor
---

Custom health checks with the `@HealthCheck` decorator and `HealthIndicator` class, discovered automatically and run by `HealthEngine` in parallel with a timeout. `DataPlugin`, `KafkaPlugin` and `RabbitMQPlugin` register one health check per connection (disable with `healthChecks: false`). `HealthEngine.checkAll()` and `HealthEngine.checkApp()` are now asynchronous.
