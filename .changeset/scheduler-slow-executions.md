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
"@axisparkjs/schedule": patch
"@axisparkjs/security": patch
"@axisparkjs/test": patch
"@axisparkjs/websocket": patch
"@axisparkjs/websocket-socketio": patch
---

Cron and interval jobs keep running when an execution takes longer than the time to the next one. The executions missed while the job was running are skipped, the next one is calculated from the current time, and a warning with the job name is logged. Two executions of the same job never overlap. `JobDefinition` and `JobTrigger` have a new `getNextExecutionTimeAfter(date)` method.
