import { PluginOptions } from '@axisparkjs/core';
import { ExecutionContext } from '@axisparkjs/engine';

/**
 * Options for configuring the telemetry plugin. The plugin only instruments the framework with the OpenTelemetry API: the application
 * configures the SDK, its resource (such as `service.name`) and its exporters with the official packages, such as `@opentelemetry/sdk-node`.
 */
export interface TelemetryPluginOptions extends PluginOptions {
    /** Whether to create spans. Defaults to true. */
    traces?: boolean;
    /** Whether to record metrics. Defaults to true. */
    metrics?: boolean;
    /** Whether to add the `trace_id` and `span_id` of the active span to the log entries. Defaults to true when the traces are enabled. */
    logCorrelation?: boolean;
    /**
     * Whether to report the `axispark.health.status` gauge. The health checks run every time the metrics are collected.
     * Defaults to true when the metrics are enabled.
     */
    healthMetrics?: boolean;
    /** Handlers excluded from the instrumentation, such as the health checks. They produce no span and no metric. */
    ignore?: (context: ExecutionContext) => boolean;
}
