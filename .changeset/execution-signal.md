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

Every execution has an `AbortSignal` in the new `signal` property of `ExecutionContext`, injected in the handlers with the new `@Signal()` parameter decorator of `@axisparkjs/engine`. The `ExecutionEngine` creates it for each execution and aborts it with an `ExecutionTimeoutError` when the timeout ends, before the timeout resolver runs, so the handler stops while the `408` is being sent; the response of a timed-out execution does not change and a late result is discarded. It is also aborted with the reason of the signal of the transport: a new `ClientDisconnectedError` when the HTTP connection is closed before the response is sent (new optional `HttpRequest.signal`, implemented by the Express and Fastify adapters with the new `clientDisconnectSignal()` helper of `@axisparkjs/http`) or the WebSocket connection is closed (new optional `WebSocketConnection.signal`, implemented by the Socket.IO adapter with one listener per socket), and the reason of `McpRequest.signal` when the MCP client cancels the request. When the client stops waiting and the handler fails because of the abort, the error filters are skipped, so the error is not handled as a failure of the handler. The listener added to the signal of the transport is removed when the execution ends. Handlers that do not use the signal behave as before. Custom transports that build an `ExecutionContext` must now give a `signal` (their own, or any signal: the engine replaces it with the signal of the execution). The `versioning-and-timeouts` sample has slow reports that stop on timeout and on disconnection.
