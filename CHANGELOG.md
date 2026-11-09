# Changelog

All the `@axisparkjs/*` packages are released together and share the same version. This file lists
the changes of each release; it is generated from the changesets when a version is released (see
`scripts/release-notes.mjs`). A changeset that starts with a short bold title, such as `**MCP server.**`,
gives the website changelog the name of the feature to highlight.

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
