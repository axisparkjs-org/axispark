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

The `@Timeout()` of a WebSocket event acknowledges a timeout error to the client when the time ends, instead of leaving it without a response. `WebSocketPlugin` always registers `WebSocketTimeoutResolver`, which throws the new `WebSocketRequestTimeoutError` (`WebSocketError` with status `408`), and the `WebSocketReturnErrorFilter` sends it through the ack with the event name as its description: `{ "error": "Request timed out after 100ms", "status": 408, "description": "Event 'slow'" }`. The WebSocket plugin has new `timeout` and `timeoutOptions` (`time` and `message`) options, as the HTTP plugin: with `timeout: true`, every event has the default timeout, and `@NoTimeout()` disables it. `timeout` is `false` by default, and the Socket.IO `WebSocketPluginOptionsFactory` sets a default time of `5000` ms. `TimeoutProcessor` throws the new `ExecutionTimeoutError` from `@axisparkjs/engine` when no timeout resolver is registered for the transport, so the error filters of the transport handle the timeout instead of receiving an empty result.

The `ReturnErrorFilter` of `@axisparkjs/websocket` is renamed to `WebSocketReturnErrorFilter`, as `McpReturnErrorFilter`, so it is no longer replaced by the `ReturnErrorFilter` of `@axisparkjs/http` in the `ClassRegistry`, which left the WebSocket errors without an acknowledgement. This is a breaking change only for code that imports the class by name.
