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

The `SchedulePlugin` stops gracefully when the application stops: it stops scheduling new executions, aborts the signal of the running jobs, and waits for them, up to the new `shutdownTimeout` option (25 seconds by default with `SchedulePluginOptionsFactory`, `0` does not wait), before the next plugins are stopped. The `no-overlap` jobs that end during the shutdown release their locks while the lock store is still open, so another instance can run them right away. When the timeout ends first, a warning with the names of the jobs that are still running is logged, and the heartbeat of their locks is stopped, so the locks expire with their ttl once the process exits. Jobs receive an `AbortSignal` as their first argument, aborted when the job is stopped, so long jobs can end early between their steps. `SchedulerRunner` tracks the running executions, with a new `isExecuting(job)` method, and `SchedulerService` has a new `isJobExecuting(job)` method. A job that stops itself does not wait for its own execution.

Breaking changes: `SchedulerService.stopJob()`, `SchedulerService.stopAllJobs()`, `SchedulerRunner.stop()` and `SchedulerRunner.stopAll()` return a `Promise<void>` that resolves when the running executions end, and accept the new `SchedulerStopOptions` (`timeout`). Without a `timeout`, they wait until the executions end. Code that calls them without `await` keeps working, but without waiting. `JobDefinition.execute(signal?)` passes the signal to the job function, typed as the new `JobFunction`.
