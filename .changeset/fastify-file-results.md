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

`HttpResults.File()` and `HttpResults.Download()` send the file with the Fastify adapter, instead of answering `200` with an empty body. The route handler of the Fastify adapter returns the reply, so Fastify waits for the replies that are sent after the handler ends, which also fixes the empty body of `HttpResults.Stream()` with Fastify. The path of a file result means the same with both adapters: an absolute path, sent from its own folder, so it no longer depends on the `public` folder of the Fastify adapter. Both adapters keep the `Content-Type` set by the result and send the files inside folders that start with a dot.

A missing file is answered with `404` in the JSON format of the framework with both adapters, instead of the HTML page of Express or an empty `200`. `HttpResponse.file()` returns a promise that resolves when the file is sent, and `FileHttpResult` waits for it.

Breaking changes: `HttpResults.File()` and `HttpResults.Download()` throw an error for a relative path, which the filters answer with `500` and a message that explains it. Build the path with `path.join(__dirname, ...)`, for example. Custom implementations of `HttpResponse` must return a promise from `file()`.
