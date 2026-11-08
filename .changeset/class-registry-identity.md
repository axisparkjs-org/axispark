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

`ClassRegistry` stores the classes by identity instead of by name, so two decorated classes with the same name no longer replace each other. Applications that use the HTTP and WebSocket plugins together answer the HTTP errors with their status and body again, instead of an empty `200`, and two user classes with the same name, such as two `UserController` in different folders, are both registered. `ClassRegistry.remove()` only removes the given class, so disabling a framework component never removes a user class with the same name. `ClassRegistry` has a new `has(constructor)` method and a new `getAllByName(name)` method, which returns every class with that name.

Breaking changes: `ClassRegistry.get(name)` is removed, because a name does not identify a single class. Use `ClassRegistry.has(constructor)` or `ClassRegistry.getAllByName(name)` instead. The `ReturnErrorFilter` of `@axisparkjs/websocket` is renamed to `WebSocketReturnErrorFilter`, as `McpReturnErrorFilter`.
