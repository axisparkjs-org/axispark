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

A stream error in `HttpResults.Stream()` no longer stops the process with the Express adapter. Both adapters send the stream with `pipeline()`, which destroys the response when the source fails and the source when the client closes the connection, and `HttpResponse.stream()` returns a promise that resolves at the end of the transfer and rejects with the error of the source. A stream that fails before sending any data is answered with `500` in the JSON format of the framework, with both adapters, and a stream that fails in the middle of the transfer closes the connection, so the client sees an incomplete transfer. The error is logged with the route by the HTTP logger when `logErrors` is enabled. The Fastify adapter sends the content of the streams, instead of an empty body.

The errors that happen after the handler and the filters, while the response is sent, are logged by `HttpEngine` instead of being thrown to the adapter, and a response that has not started yet is answered with `500`.

Breaking changes: custom implementations of `HttpResponse` must return a promise from `stream()`.
