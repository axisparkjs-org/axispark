import { AxiSparkContext, HealthEngine, Plugin, PluginNotConfiguredError } from '@axisparkjs/core';
import { Injectable, Injector } from '@axisparkjs/di';
import { ExecutionEngine, RateLimitProcessor } from '@axisparkjs/engine';
import { Logger } from '@axisparkjs/logger';
import { SchedulerRunner } from '@axisparkjs/schedule';
import { registerStoreInstrumentation } from '@axisparkjs/store';
import { metrics, trace } from '@opentelemetry/api';
import { ExecutionTelemetry, HealthTelemetry, JobTelemetry, RateLimitTelemetry, StoreTelemetry, traceLogEnricher } from '../instrumentations';
import { INSTRUMENTATION_SCOPE } from '../telemetry-names';
import { TelemetryPluginOptions } from './telemetry-plugin-options';

/**
 * A plugin that instruments the framework with OpenTelemetry: a span and the duration of every handler (HTTP, WebSocket and MCP), the
 * executions of the scheduled jobs, the rejections of the rate limits, the duration of the store operations, the status of the health
 * checks, and the trace of the active span in the log entries.
 *
 * It registers the hooks of the framework packages when it is registered, and removes them when it stops. It does not configure the
 * OpenTelemetry SDK: start the SDK before the application, so the tracer and the meter of the plugin export to it.
 */
@Injectable()
export class TelemetryPlugin extends Plugin {
    protected options: TelemetryPluginOptions;
    private health?: HealthTelemetry;

    constructor(
        private logger: Logger,
        private readonly injector: Injector
    ) {
        super();
    }

    async onRegister(_context: AxiSparkContext, options?: TelemetryPluginOptions): Promise<void> {
        if (!options) throw new PluginNotConfiguredError(TelemetryPlugin.name);
        this.options = options;
        this.logger = this.logger.child('TelemetryPlugin');

        const tracesEnabled = options.traces ?? true;
        const metricsEnabled = options.metrics ?? true;
        const tracer = tracesEnabled ? trace.getTracer(INSTRUMENTATION_SCOPE) : undefined;
        const meter = metricsEnabled ? metrics.getMeter(INSTRUMENTATION_SCOPE) : undefined;

        if (tracer || meter) {
            ExecutionEngine.registerInstrumentation(new ExecutionTelemetry({ tracer, meter, ignore: options.ignore }));
            SchedulerRunner.registerInstrumentation(new JobTelemetry(tracer, meter));
        }
        if (meter) {
            RateLimitProcessor.registerInstrumentation(new RateLimitTelemetry(meter));
            registerStoreInstrumentation(new StoreTelemetry(meter));
            if (options.healthMetrics ?? true) this.health = new HealthTelemetry(meter, await this.injector.get(HealthEngine));
        }
        if (tracer && (options.logCorrelation ?? true)) Logger.registerEnricher(traceLogEnricher);

        await this.logger.info(`Plugin registered with ${[tracer && 'traces', meter && 'metrics'].filter(Boolean).join(' and ') || 'no signals'}`);
    }

    async onStart(): Promise<void> {
        await this.logger.info('Plugin started');
    }

    async onStop(): Promise<void> {
        ExecutionEngine.registerInstrumentation();
        SchedulerRunner.registerInstrumentation();
        RateLimitProcessor.registerInstrumentation();
        registerStoreInstrumentation();
        Logger.registerEnricher();
        this.health?.dispose();
        this.health = undefined;
        await this.logger.info('Plugin stopped');
    }
}
