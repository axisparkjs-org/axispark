import { HealthEngine, PluginNotConfiguredError } from '@axisparkjs/core';
import { Injector } from '@axisparkjs/di';
import { ExecutionEngine, RateLimitProcessor } from '@axisparkjs/engine';
import { Logger } from '@axisparkjs/logger';
import { SchedulerRunner } from '@axisparkjs/schedule';
import { InMemoryCacheStore, instrumentStore } from '@axisparkjs/store';
import { context as otelContext, trace } from '@opentelemetry/api';
import { TestTelemetry } from '../../test/otel';
import { ExecutionTelemetry, JobTelemetry, RateLimitTelemetry } from '../instrumentations';
import { TelemetryPlugin } from './telemetry-plugin';
import { TelemetryPluginOptionsFactory } from './telemetry-plugin-options-factory';

describe('TelemetryPlugin', () => {
    let telemetry: TestTelemetry;
    let plugin: TelemetryPlugin;
    let logger: jest.Mocked<Logger>;
    let injector: jest.Mocked<Injector>;
    let healthEngine: { checkAll: jest.Mock };
    const context = {} as any;

    const registered = () => ({
        execution: (ExecutionEngine as any).instrumentation,
        job: (SchedulerRunner as any).instrumentation,
        rateLimit: (RateLimitProcessor as any).instrumentation,
        enricher: (Logger as any).enricher
    });

    beforeEach(() => {
        telemetry = new TestTelemetry().register();
        logger = { child: jest.fn().mockReturnThis(), info: jest.fn() } as unknown as jest.Mocked<Logger>;
        healthEngine = { checkAll: jest.fn().mockResolvedValue([]) };
        injector = { get: jest.fn().mockResolvedValue(healthEngine) } as unknown as jest.Mocked<Injector>;
        plugin = new TelemetryPlugin(logger, injector);
    });

    afterEach(async () => {
        await plugin.onStop();
        await telemetry.shutdown();
    });

    it('throws when the options are not provided', async () => {
        await expect(plugin.onRegister(context)).rejects.toThrow(PluginNotConfiguredError);
    });

    it('registers every hook with the default options', async () => {
        await plugin.onRegister(context, TelemetryPluginOptionsFactory.create());

        expect(registered()).toEqual({
            execution: expect.any(ExecutionTelemetry),
            job: expect.any(JobTelemetry),
            rateLimit: expect.any(RateLimitTelemetry),
            enricher: expect.any(Function)
        });
        expect(injector.get).toHaveBeenCalledWith(HealthEngine);
        expect(logger.child).toHaveBeenCalledWith('TelemetryPlugin');
        expect(logger.info).toHaveBeenCalledWith('Plugin registered with traces and metrics');
    });

    it('instruments the stores and reports the health checks', async () => {
        await plugin.onRegister(context, TelemetryPluginOptionsFactory.create());

        await instrumentStore('cache', new InMemoryCacheStore()).get('key');

        expect(await telemetry.dataPoints('axispark.store.operation.duration')).toHaveLength(1);
        await telemetry.dataPoints('axispark.health.status');
        expect(healthEngine.checkAll).toHaveBeenCalled();
    });

    it('adds the trace of the active span to the log entries', async () => {
        await plugin.onRegister(context, TelemetryPluginOptionsFactory.create());
        const span = telemetry.tracer().startSpan('request');

        const metadata = otelContext.with(trace.setSpan(otelContext.active(), span), () => (Logger as any).enricher());

        expect(metadata).toEqual({ trace_id: span.spanContext().traceId, span_id: span.spanContext().spanId });
    });

    it('registers only the hooks of the enabled signals', async () => {
        await plugin.onRegister(context, TelemetryPluginOptionsFactory.create({ metrics: false }));
        expect(registered()).toEqual({
            execution: expect.any(ExecutionTelemetry),
            job: expect.any(JobTelemetry),
            rateLimit: undefined,
            enricher: expect.any(Function)
        });
        await plugin.onStop();

        await plugin.onRegister(context, TelemetryPluginOptionsFactory.create({ traces: false, healthMetrics: false }));
        expect(registered()).toEqual({
            execution: expect.any(ExecutionTelemetry),
            job: expect.any(JobTelemetry),
            rateLimit: expect.any(RateLimitTelemetry),
            enricher: undefined
        });
        expect(injector.get).not.toHaveBeenCalled();
        await plugin.onStop();

        await plugin.onRegister(context, TelemetryPluginOptionsFactory.create({ logCorrelation: false }));
        expect(registered().enricher).toBeUndefined();
        await plugin.onStop();

        await plugin.onRegister(context, { plugin: TelemetryPlugin, traces: false, metrics: false });
        expect(registered()).toEqual({ execution: undefined, job: undefined, rateLimit: undefined, enricher: undefined });
        expect(logger.info).toHaveBeenCalledWith('Plugin registered with no signals');
    });

    it('enables every signal when the options do not set them', async () => {
        await plugin.onRegister(context, { plugin: TelemetryPlugin });

        expect(logger.info).toHaveBeenCalledWith('Plugin registered with traces and metrics');
    });

    it('logs when it starts', async () => {
        await plugin.onStart();

        expect(logger.info).toHaveBeenCalledWith('Plugin started');
    });

    it('removes every hook when it stops', async () => {
        await plugin.onRegister(context, TelemetryPluginOptionsFactory.create());

        await plugin.onStop();

        expect(registered()).toEqual({ execution: undefined, job: undefined, rateLimit: undefined, enricher: undefined });
        await telemetry.dataPoints('axispark.health.status');
        expect(healthEngine.checkAll).not.toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledWith('Plugin stopped');
    });
});
