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

Cancelling a prompt of `axispark create` (Ctrl+C or Esc) stops the command with the message `Cancelled.` and the exit code `130`, before anything is written to disk, instead of failing with an internal error. Cancelling the "Install dependencies?" prompt, when the project already exists, continues without installing and shows the `npm install` step. The project name is validated while typing, and an invalid name is reported with the rule: `Invalid project name "…". Use only letters, numbers, "-" and "_".` The CLI prints the errors of the commands in one line, without a stack trace, and exits with the code `1`. The new `--verbose` option, or the `DEBUG` environment variable, prints the stack trace.
