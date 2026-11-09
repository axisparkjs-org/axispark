# Changelog

All the `@axisparkjs/*` packages are released together and share the same version. This file lists
the changes of each release; it is generated from the changesets when a version is released (see
`scripts/release-notes.mjs`). A changeset that starts with a short bold title, such as `**MCP server.**`,
gives the website changelog the name of the feature to highlight.

## 1.5.1 (2026-11-09)

### Improvements and fixes

- Fix deployment of web

## 1.5.0 (2026-11-09)

### Features

- **Scanner include and exclude.** New `scanner` option in `AxiSparkConfig` with `include` and `exclude` glob patterns to choose the files that `FileSystemScanner` loads from `basePath`. The `exclude` patterns are added to the default exclusions, which now also ignore every bootstrap file (`*.bootstrap.{js,ts}`, not only `index.bootstrap`), the `*.test.{js,ts}` files and the `coverage` folder. The scanner logs the number of loaded files at `debug` level and each file at `trace` level. Applications that relied on the scanner importing bootstrap files other than `index.bootstrap` must import them explicitly.
- **Handler cache.** Cache of the handler results in `@axisparkjs/engine`, independent of the transport and kept in the `cache` store of `@axisparkjs/store`. A handler, or a class, decorated with the new `@Cache({ ttl?, key? })` returns its cached result while it is valid instead of running again, and `@NoCache()` disables the `@Cache()` of its class. The cache is opt-in: no handler is cached without `@Cache()`. The middlewares, guards and before interceptors run on every request, also on cache hits, and the after interceptors and the result processor run as usual, so a cached result produces the same response as a fresh one. Only plain results are cached: `undefined`, the `ResultDefinition` instances (`HttpResults.File()`, streams, redirects…) and the errors are not. When the store fails, the handlers run without cache and a warning is logged at most once a minute. The new `CacheService` evicts every result of a handler (`evict(ProductController, 'find')`) with a generation counter, or one entry (`evict(ProductController, 'find', key)`). The engine has the new `CacheDefinition`, `CacheGenerator`, `CacheResolver` and `CacheProcessor`, and `ExecutionPlan` has a new `cache` field.

  The HTTP plugin caches the `GET` and `HEAD` requests of the handlers with `@Cache()`, with a key made of the method, the host, the path and the sorted query string. The requests with an `Authorization` or `Cookie` header are not cached, unless the handler has a custom `key`, for example to cache per user. The new `@CacheVary('accept-language')` decorator adds request headers to the key. The new `cacheOptions` option sets the default `ttl` (60 seconds) and the `store` (`MemoryStore()` by default, or a shared store such as `RedisStore('MAIN')`), created when the plugin starts. New `caching-responses` sample.
- **Trusted proxies.** New `trustProxy` option in `HttpPluginOptions` to resolve the client address from the `X-Forwarded-For` header when the application runs behind a reverse proxy or a load balancer. It accepts `true`, the number of trusted proxies, or the addresses and subnets of the trusted proxies, and is passed to Express (`trust proxy` setting) and Fastify (`trustProxy` server option). It defaults to `false`, so `request.ip` and the rate limits keep using the socket address unless it is set.
- **Shared rate limiting.** The rate limit buckets and the sliding window move from `HttpRateLimitResolver` (`@axisparkjs/http`) to `RateLimitProcessor` (`@axisparkjs/engine`), so every transport counts requests with the same algorithm. The requests are counted per transport, client and handler in a new `RateLimitStore`, with the `InMemoryRateLimitStore` used by default and replaceable with `RateLimitProcessor.registerRateLimitStore()`. `RateLimitResolver.resolve(context)` now returns the client identifier instead of the decision, and `HttpRateLimitResolver` returns `request.ip`. HTTP rate limiting keeps the same options, decorators, `429` response and `Retry-After` header. Custom resolvers registered with `RateLimitProcessor.registerRateLimit()` must return the client identifier.
- **Redis.** New `@axisparkjs/redis` package with the `RedisPlugin`, which manages named Redis connections based on `node-redis`. The connections are configured with a name, a URL and the client options, injected with `@InjectRedisConnection(name)` or retrieved from the `RedisConnectionManager`, and closed when the application stops. The `ready`, `reconnecting`, `error` and `end` events are logged, and connection errors never stop the process. The clients connect in the background, so the application starts even when Redis is not available, and a `redis:<name>` health check is registered for each connection unless `healthChecks` is `false`.
- **Graceful scheduler shutdown.** The `SchedulePlugin` stops gracefully when the application stops: it stops scheduling new executions, aborts the signal of the running jobs, and waits for them, up to the new `shutdownTimeout` option (25 seconds by default with `SchedulePluginOptionsFactory`, `0` does not wait), before the next plugins are stopped. The `no-overlap` jobs that end during the shutdown release their locks while the lock store is still open, so another instance can run them right away. When the timeout ends first, a warning with the names of the jobs that are still running is logged, and the heartbeat of their locks is stopped, so the locks expire with their ttl once the process exits. Jobs receive an `AbortSignal` as their first argument, aborted when the job is stopped, so long jobs can end early between their steps. `SchedulerRunner` tracks the running executions, with a new `isExecuting(job)` method, and `SchedulerService` has a new `isJobExecuting(job)` method. A job that stops itself does not wait for its own execution.

  Breaking changes: `SchedulerService.stopJob()`, `SchedulerService.stopAllJobs()`, `SchedulerRunner.stop()` and `SchedulerRunner.stopAll()` return a `Promise<void>` that resolves when the running executions end, and accept the new `SchedulerStopOptions` (`timeout`). Without a `timeout`, they wait until the executions end. Code that calls them without `await` keeps working, but without waiting. `JobDefinition.execute(signal?)` passes the signal to the job function, typed as the new `JobFunction`.
- **Pluggable stores.** New `@axisparkjs/store` package with pluggable stores. Every feature that keeps state uses an in-memory store by default and accepts a `StoreProvider`, a function that the plugin calls with the kind of store it needs (`'rate-limit'`, `'lock'` or `'cache'`) when it starts. `MemoryStore()` provides `InMemoryRateLimitStore`, `InMemoryLockStore` and `InMemoryCacheStore`, and `RedisStore(connection, { prefix })` from `@axisparkjs/redis` provides `RedisRateLimitStore`, `RedisLockStore` and `RedisCacheStore`, which share the state between every instance connected to the same Redis. The HTTP rate limits accept `rateLimitOptions.store`, and the `SchedulePlugin` accepts a `lockStore` option, created with the new `SchedulePluginOptionsFactory`, for the new exclusive jobs: `@Cron({ value, exclusive: true })` runs each occurrence on only one instance, and `exclusive: { mode: 'no-overlap' }` never runs the job on two instances at the same time.

  Breaking changes: `RateLimitStore`, `RateLimitDecision` and `InMemoryRateLimitStore` move from `@axisparkjs/engine` to `@axisparkjs/store`, with no re-exports, and `HttpRateLimitResolver` no longer re-exports `RateLimitDecision`. `RateLimitStore.consume()` receives a `RateLimitPolicy` (`ttl` and `limit`), which `RateLimitDefinition` implements. `RateLimitProcessor.registerRateLimitStore(transport, store)` registers the store of one transport, so each plugin keeps its own store and never replaces the store of another one, and it has no in-memory default: register custom stores with `rateLimitOptions: { store: () => new MyStore() }` instead of calling it.
- **WebSocket rate limits.** Rate limits for the WebSocket events. The WebSocket plugin has new `rateLimit` and `rateLimitOptions` options (`ttl`, `limit`, `message`, `by` and `store`), as the HTTP plugin: with `rateLimit: true`, the new `WsRateLimitGuard` counts the events of each client per event handler, and the events beyond the limit are rejected with the new `WebSocketRateLimitExceededError` before the handler is invoked. The client receives it through the acknowledgement: `{ "error": "Too many requests. Please try again later.", "status": 429, "retryAfterMs": 750 }`. `@RateLimit()` and `@NoRateLimit()` work on WebSocket gateways and events as on HTTP controllers. The new `WsRateLimitResolver` identifies the clients with `rateLimitOptions.by`: `'address'` (default), so reconnecting does not reset the limits, `'connection'`, or a function, for example to count the events per authenticated user. The rate limits use the store of `rateLimitOptions.store` (`MemoryStore()` by default), created when the plugin starts, so the HTTP and WebSocket plugins can use different stores. `WebSocketError` has a new `details` getter, whose fields are added to the acknowledgement of the error.

  `WebSocketConnection` has a new `remoteAddress` property with the address of the client. The WebSocket plugin has a new `trustProxy` option, with the same values as the HTTP plugin, to resolve it from the `X-Forwarded-For` header of the handshake behind trusted proxies. It defaults to `false`, or to the `trustProxy` of the HTTP plugin with `useHttpPluginServer`. Breaking change for custom WebSocket adapters: their connections must implement `remoteAddress`.

### Improvements and fixes

- `ClassRegistry` stores the classes by identity instead of by name, so two decorated classes with the same name no longer replace each other. Applications that use the HTTP and WebSocket plugins together answer the HTTP errors with their status and body again, instead of an empty `200`, and two user classes with the same name, such as two `UserController` in different folders, are both registered. `ClassRegistry.remove()` only removes the given class, so disabling a framework component never removes a user class with the same name. `ClassRegistry` has a new `has(constructor)` method and a new `getAllByName(name)` method, which returns every class with that name.

  Breaking changes: `ClassRegistry.get(name)` is removed, because a name does not identify a single class. Use `ClassRegistry.has(constructor)` or `ClassRegistry.getAllByName(name)` instead. The `ReturnErrorFilter` of `@axisparkjs/websocket` is renamed to `WebSocketReturnErrorFilter`, as `McpReturnErrorFilter`.
- The cron job class of `@axisparkjs/schedule` is renamed from `CronJobDefinitio` to `CronJobDefinition`, the name used in the documentation. The old name is no longer exported: replace `CronJobDefinitio` with `CronJobDefinition` in your imports.
- `ExpressHttpAdapter.start()` resolves when the server is listening and rejects with the `listen` error (for example `EADDRINUSE`), so the application fails to start with a clear error instead of logging that it is listening and crashing later. `stop()` closes the idle keep-alive connections, resolves when the server is closed, and closes the connections that are still open after 10 seconds.
- `HttpTransport` sends the error of a log entry with its `name`, `message`, `stack` and `cause`, as `JsonFormatter` does, instead of an empty object. The rest of the entry keeps the same structure.
- The `@axisparkjs/logger` package documentation explains which transport is used when `logTransports` is not set, that the `ConsoleTransport` writes to the standard output, and how to write the logs to `stderr` with a `StreamTransport`, for example when using the MCP stdio transport.
- `@NoTimeout()` disables the timeout of a handler instead of making the request time out immediately. It defines `{ disabled: true }` in the timeout metadata instead of a time of `-1`, and `TimeoutGenerator` returns no timeout for a disabled metadata or a negative time. The method metadata still takes precedence over the class metadata, so `@NoTimeout()` on a method disables a `@Timeout()` of its class and the default timeout of the transport, and `@NoTimeout()` on a class disables the timeout of all its handlers unless a method has its own `@Timeout()`. `@Timeout(time)` throws an error when the time is not a number greater than `0`, so the mistake is visible at startup. `TimeoutMetadata.time` is now optional.
- The HTTP rate limit is applied per route instead of per requested URL: the bucket key is built with the client IP, the HTTP method and the handler, so changing a route parameter (`/users/1`, `/users/2`…) or the query string no longer bypasses the limit. `FastifyHttpRequest.path` returns the path without the query string, as `ExpressHttpRequest.path` does.
- Cron and interval jobs keep running when an execution takes longer than the time to the next one. The executions missed while the job was running are skipped, the next one is calculated from the current time, and a warning with the job name is logged. Two executions of the same job never overlap. `JobDefinition` and `JobTrigger` have a new `getNextExecutionTimeAfter(date)` method.
- Jobs whose next execution is more than ~24.8 days away (the maximum delay of a Node.js timer) no longer run in a loop: the `SchedulerRunner` waits with several timers and runs the job only at its scheduled time, so `@Cron(CronExpression.EveryYear)`, `@Cron(CronExpression.EveryMonth)` and long `@Interval()`, `@Date()` and `@Timeout()` jobs no longer print a `TimeoutOverflowWarning`.
- The `@Timeout()` of a WebSocket event acknowledges a timeout error to the client when the time ends, instead of leaving it without a response. `WebSocketPlugin` always registers `WebSocketTimeoutResolver`, which throws the new `WebSocketRequestTimeoutError` (`WebSocketError` with status `408`), and the `WebSocketReturnErrorFilter` sends it through the ack with the event name as its description: `{ "error": "Request timed out after 100ms", "status": 408, "description": "Event 'slow'" }`. The WebSocket plugin has new `timeout` and `timeoutOptions` (`time` and `message`) options, as the HTTP plugin: with `timeout: true`, every event has the default timeout, and `@NoTimeout()` disables it. `timeout` is `false` by default, and the Socket.IO `WebSocketPluginOptionsFactory` sets a default time of `5000` ms. `TimeoutProcessor` throws the new `ExecutionTimeoutError` from `@axisparkjs/engine` when no timeout resolver is registered for the transport, so the error filters of the transport handle the timeout instead of receiving an empty result.

  The `ReturnErrorFilter` of `@axisparkjs/websocket` is renamed to `WebSocketReturnErrorFilter`, as `McpReturnErrorFilter`, so it is no longer replaced by the `ReturnErrorFilter` of `@axisparkjs/http` in the `ClassRegistry`, which left the WebSocket errors without an acknowledgement. This is a breaking change only for code that imports the class by name.

## 1.4.0 (2026-11-03)

### Features

- **MCP server.** New `@axisparkjs/mcp` package with the `McpPlugin`, which exposes tools, resources and prompts to AI clients through the Model Context Protocol. Classes decorated with `@McpServer()` declare `@McpTool()`, `@McpResource()` and `@McpPrompt()` handlers that run through the `ExecutionEngine` (new `ExecutionTransport.Mcp`), receive `@McpArgs()`, `@McpParam()`, `@McpSession()` and `@McpContext()` parameters, and publish tool input schemas generated from their `class-validator` classes. The plugin serves stdio and Streamable HTTP, on its own port or mounted on the HTTP plugin server with `useHttpPluginServer`.
- **Custom health checks.** Custom health checks with the `@HealthCheck` decorator and `HealthIndicator` class, discovered automatically and run by `HealthEngine` in parallel with a timeout. `DataPlugin`, `KafkaPlugin` and `RabbitMQPlugin` register one health check per connection (disable with `healthChecks: false`). `HealthEngine.checkAll()` and `HealthEngine.checkApp()` are now asynchronous.
- **Data transactions.** Transactions in the Data plugin: the `@Transactional()` method decorator and the `TransactionManager` service run several repository calls in a single transaction. Every repository call made inside it joins the transaction automatically, including derived query methods.
- **Log metadata.** The `Logger` level methods accept an optional `metadata` argument (`info(message, metadata?)`, `error(message, error?, metadata?)`), and `child(scope, metadata?)` binds metadata that is merged into every entry of the child logger. `SimpleFormatter` prints the metadata, and `XmlFormatter` keeps metadata and stacks that contain `]]>` inside their CDATA sections.

### Improvements and fixes

- `axispark create` removes the project directory it created when copying the template or updating `package.json` fails, keeps the project when only the dependency installation fails, and rejects an unknown `--template` before downloading anything, listing the available templates.
- Derived repository methods match property names against the entity columns before reading `And`, `Or` and `OrderBy` as keywords, so properties such as `originCountry`, `orderId` or `androidVersion` are no longer split.

## 1.3.1 (2026-10-30)

### Improvements and fixes

- The documentation moved to its own repository and is published at [axisparkjs.com](https://axisparkjs.com).
- Fixes in the release pipeline.

## 1.3.0 (2026-10-23)

### Features

- **HTTP rate limiting.** Rate limiting for HTTP routes. The rate limit definitions, metadata and generation live in `@axisparkjs/engine`, so they can be reused by other transports, and HTTP rate limits are enforced by an HTTP guard.
- **Host-based routing.** Host-based routing for HTTP controllers.
- **File uploads.** Opt-in `multipart/form-data` file uploads in the HTTP plugin with the `fileUpload` and `fileUploadOptions` options, the `@UploadedFile()` and `@UploadedFiles()` parameter decorators, and the `@FileUpload()` decorator to override the limits per controller or handler.
- **DTO validation.** The `ValidateSchema()` pipe-step validates parameters against their declared DTO class using `class-validator`.
- **400 for invalid input.** Pipe-step parsing and validation errors are returned as `400 Bad Request` responses instead of `500 Internal Server Error`.
- **WebSocket event patterns.** Regular expressions in WebSocket event names.

### Improvements and fixes

- New project templates for `axispark create`: HTTP + Security, Scheduler, and HTTP + OpenAPI.
- Pipe-step configurations are passed to the pipe-steps at runtime.
- The request timeout is cleared when the execution finishes.
- HTTP semantics references updated to RFC 9110.
- Documentation and API reference of the `@axisparkjs/ddd` package.

## 1.2.0 (2026-10-07)

### Features

- **Data plugin.** New `@axisparkjs/data` package with the `DataPlugin`: TypeORM data sources for SQL databases and MongoDB, generated entity repositories and derived queries.
- **Security.** New `@axisparkjs/security` package: transport-neutral authentication and authorization with your own authenticators, authorization policies and identity model.
- **Kafka.** New `@axisparkjs/kafka` package to manage Kafka connections and clients.

## 1.1.0 (2026-09-30)

### Features

- **WebSocket.** WebSocket support: new `@axisparkjs/websocket` package with event-based handlers, namespaces, connection management and acknowledgments, and the `@axisparkjs/websocket-socketio` adapter.
- **RabbitMQ.** New `@axisparkjs/rabbitmq` package to manage RabbitMQ connections.

### Improvements and fixes

- The scheduler logs the errors of failed job executions and initializes the job instances on the start step.
- The packages include their README and license.

## 1.0.0 (2026-08-25)

First release of AxiSpark.js.

### Features

- **Application core.** Application core (`@axisparkjs/core`) with a plugin system and an application lifecycle.
- **Dependency injection.** Dependency injection container (`@axisparkjs/di`).
- **Logging.** Logging (`@axisparkjs/logger`).
- **Engine system.** Engine system (`@axisparkjs/engine`), shared by every transport: middlewares, guards, interceptors, filters, pipes, parameters, execution context and timeouts.
- **HTTP plugin.** HTTP plugin (`@axisparkjs/http`) with controllers, parameters, responses and API versioning, served by the Express (`@axisparkjs/http-express`) or Fastify (`@axisparkjs/http-fastify`) adapters.
- **OpenAPI.** OpenAPI documentation of the HTTP controllers (`@axisparkjs/openapi`).
- **Scheduler.** Scheduled jobs (`@axisparkjs/schedule`).
- **DDD building blocks.** Domain-Driven Design building blocks (`@axisparkjs/ddd`).
- **Testing utilities.** Testing utilities (`@axisparkjs/test`).
- **Project generator.** `axispark create` command (`@axisparkjs/cli`) to start a new project from a template.
