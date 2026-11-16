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

`FileTransport`, `RotatingFileTransport` and `DailyFileTransport` keep the file open with a `WriteStream` in append mode instead of calling `appendFile`, which opened and closed the file for every entry. The entries are written in order, the rotating transport counts the size of the file in memory and closes it before rotating, the daily transport switches to the new file when the day changes, and the files are closed by `Logger.flush()` and `app.destroy()`. New `LogTransport.flush()` and `Logger.flush()`.
