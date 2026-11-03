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

The `Logger` level methods accept an optional `metadata` argument (`info(message, metadata?)`, `error(message, error?, metadata?)`), and `child(scope, metadata?)` binds metadata that is merged into every entry of the child logger. `SimpleFormatter` prints the metadata, and `XmlFormatter` keeps metadata and stacks that contain `]]>` inside their CDATA sections.
