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
"@axisparkjs/telemetry": minor
"@axisparkjs/test": minor
"@axisparkjs/websocket": minor
"@axisparkjs/websocket-socketio": minor
---

**OpenTelemetry.** New `@axisparkjs/telemetry` package with the `TelemetryPlugin`, which instruments the framework with the OpenTelemetry API: a span and the `axispark.execution.duration` histogram for every handler of the HTTP, WebSocket and MCP transports, and the `http.server.request.duration` histogram for the HTTP requests, with the route template (`/products/:id`) and the status code. The HTTP spans continue the trace of the `traceparent` header, the handlers run inside their span, and only the `5xx` responses and the unhandled errors mark the span as an error. Every execution of a scheduled job starts a root span and is counted in `axispark.job.executions` and `axispark.job.duration` with its outcome (`executed`, `skipped` or `failed`). The plugin also records `axispark.rate_limit.rejections`, `axispark.store.operation.duration` and the `axispark.health.status` gauge, and adds the `trace_id` and `span_id` of the active span to the log entries. The options `traces`, `metrics`, `logCorrelation`, `healthMetrics` and `ignore` select what is instrumented. The plugin does not configure the SDK: the application starts it with the official packages, such as `@opentelemetry/sdk-node`, and chooses the exporters. New `observability` sample with an OpenTelemetry Collector, Prometheus and Jaeger.

The framework packages expose small hooks and never depend on OpenTelemetry: `ExecutionEngine.registerInstrumentation()` with `ExecutionInstrumentation` in `@axisparkjs/engine`, `SchedulerRunner.registerInstrumentation()` with `JobInstrumentation` in `@axisparkjs/schedule`, `RateLimitProcessor.registerInstrumentation()` with `RateLimitInstrumentation`, `registerStoreInstrumentation()` and `instrumentStore()` in `@axisparkjs/store`, and `Logger.registerEnricher()` with `LogEnricher` in `@axisparkjs/logger`, which adds metadata to every entry. Without a registered hook, the cost is one `undefined` check. `HttpResponse` has a new `statusCode` property, implemented by the Express and Fastify adapters, and `HttpContext` has a new `route` property with the template of the matched route. Breaking change for custom HTTP adapters: their responses must implement `statusCode`.
