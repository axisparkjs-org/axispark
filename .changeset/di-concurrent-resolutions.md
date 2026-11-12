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

Concurrent resolutions in the dependency injection container no longer throw false `CircularDependencyError` and `ScopeDependencyError`. Each resolution keeps its own resolution chain, passed as an argument through the container and the resolver instead of a stack shared by the resolver, so two resolutions that run at the same time never see the dependencies of each other. A singleton, or a scoped instance inside one scoped container, that is being created is shared by the concurrent resolutions, so it is created once and every resolution receives the same instance. When its factory fails, the next resolution tries again. Real circular dependencies and scope violations are still detected with the same messages, also between two concurrent resolutions that would wait for each other. The public signature of `Container.resolve()` does not change.
