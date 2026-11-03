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
"@axisparkjs/schedule": minor
"@axisparkjs/security": minor
"@axisparkjs/test": minor
"@axisparkjs/websocket": minor
"@axisparkjs/websocket-socketio": minor
---

New `@axisparkjs/mcp` package with the `McpPlugin`, which exposes tools, resources and prompts to AI clients through the Model Context Protocol. Classes decorated with `@McpServer()` declare `@McpTool()`, `@McpResource()` and `@McpPrompt()` handlers that run through the `ExecutionEngine` (new `ExecutionTransport.Mcp`), receive `@McpArgs()`, `@McpParam()`, `@McpSession()` and `@McpContext()` parameters, and publish tool input schemas generated from their `class-validator` classes. The plugin serves stdio and Streamable HTTP, on its own port or mounted on the HTTP plugin server with `useHttpPluginServer`.
