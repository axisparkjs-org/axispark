// Named *.bootstrap.ts so the scanner of the application does not load it: importing it starts the SDK.
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';

/**
 * Starts the OpenTelemetry SDK before the application. The traces and the metrics are sent with OTLP to the OpenTelemetry Collector
 * of `docker-compose.yml` (http://localhost:4318 by default, or the OTEL_EXPORTER_OTLP_ENDPOINT environment variable), which sends the
 * traces to Jaeger and exposes the metrics to Prometheus.
 */
export const sdk = new NodeSDK({
    serviceName: 'observability-sample',
    traceExporter: new OTLPTraceExporter(),
    metricReaders: [new PeriodicExportingMetricReader({ exporter: new OTLPMetricExporter(), exportIntervalMillis: 5_000 })]
});

sdk.start();
