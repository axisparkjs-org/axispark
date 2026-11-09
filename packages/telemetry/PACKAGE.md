# `@axisparkjs/telemetry`

Traces and metrics for AxiSpark.js with [OpenTelemetry](https://opentelemetry.io/).

The complete guide is in the [Telemetry documentation](https://axisparkjs.com/docs/telemetry/introduction).

## What the package does

- Creates a span and records the duration of every handler of the HTTP, WebSocket and MCP transports, with the template of the HTTP routes, never the requested path.
- Continues the trace of the `traceparent` header of the HTTP requests, and runs the handlers inside their span, so the spans of the database drivers become its children.
- Creates a root span for every execution of the scheduled jobs, and counts the executions skipped by the exclusive jobs with `outcome="skipped"`.
- Counts the requests rejected by the rate limits, and records the duration of the store operations.
- Reports the health checks as the `axispark.health.status` gauge.
- Adds the `trace_id` and `span_id` of the active span to the log entries.

The package only depends on the OpenTelemetry API. The application configures the SDK and the exporters (Prometheus, OTLP, Jaeger…).

## Install and register

```bash
npm install @axisparkjs/telemetry @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/exporter-trace-otlp-http
```

Start the SDK before the application, in a file that is not loaded by the scanner, such as `instrumentation.bootstrap.ts`:

```ts title="instrumentation.bootstrap.ts"
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

export const sdk = new NodeSDK({ serviceName: 'orders-api', traceExporter: new OTLPTraceExporter() });
sdk.start();
```

```ts title="app.ts"
import { AxiSparkFactory } from '@axisparkjs/core';
import { TelemetryPlugin, TelemetryPluginOptionsFactory } from '@axisparkjs/telemetry';

const app = AxiSparkFactory.create({ name: 'Orders API', basePath: __dirname });

app.use(TelemetryPlugin, TelemetryPluginOptionsFactory.create());
```

Without the `TelemetryPlugin`, the framework runs no instrumentation code.
