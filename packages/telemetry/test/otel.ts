import { context, metrics, propagation, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { AggregationTemporality, InMemoryMetricExporter, MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { InMemorySpanExporter, ReadableSpan, SimpleSpanProcessor, TracerProvider } from '@opentelemetry/sdk-trace';

/** An OpenTelemetry SDK with in-memory exporters, registered globally, for the tests. */
export class TestTelemetry {
    readonly spans = new InMemorySpanExporter();
    readonly tracerProvider = new TracerProvider({ spanProcessors: [new SimpleSpanProcessor({ exporter: this.spans })] });
    readonly reader = new PeriodicExportingMetricReader({
        exporter: new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE),
        exportIntervalMillis: 3_600_000
    });
    readonly meterProvider = new MeterProvider({ readers: [this.reader] });

    register(): this {
        context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
        propagation.setGlobalPropagator(new W3CTraceContextPropagator());
        trace.setGlobalTracerProvider(this.tracerProvider);
        metrics.setGlobalMeterProvider(this.meterProvider);
        return this;
    }

    tracer() {
        return this.tracerProvider.getTracer('test');
    }

    meter() {
        return this.meterProvider.getMeter('test');
    }

    finishedSpans(): ReadableSpan[] {
        return this.spans.getFinishedSpans();
    }

    /** Collects the metrics and returns the data points of one metric. */
    async dataPoints(name: string): Promise<{ attributes: Record<string, unknown>; value: any }[]> {
        const { resourceMetrics } = await this.reader.collect();
        const metric = resourceMetrics.scopeMetrics.flatMap((scope) => scope.metrics).find((item) => item.descriptor.name === name);
        return (metric?.dataPoints ?? []) as { attributes: Record<string, unknown>; value: any }[];
    }

    async shutdown(): Promise<void> {
        await this.tracerProvider.shutdown();
        await this.meterProvider.shutdown();
        trace.disable();
        metrics.disable();
        propagation.disable();
        context.disable();
    }
}
