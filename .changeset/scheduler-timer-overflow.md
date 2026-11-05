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

Jobs whose next execution is more than ~24.8 days away (the maximum delay of a Node.js timer) no longer run in a loop: the `SchedulerRunner` waits with several timers and runs the job only at its scheduled time, so `@Cron(CronExpression.EveryYear)`, `@Cron(CronExpression.EveryMonth)` and long `@Interval()`, `@Date()` and `@Timeout()` jobs no longer print a `TimeoutOverflowWarning`.
