import { AxiSparkFactory } from '@axisparkjs/core';
import { HttpPlugin } from '@axisparkjs/http';
import { HttpPluginOptionsFactory } from '@axisparkjs/http-express';
import { ConsoleTransport, JsonFormatter, LogLevel, LogTransport } from '@axisparkjs/logger';
import { SchedulePlugin } from '@axisparkjs/schedule';
import { TelemetryPlugin, TelemetryPluginOptionsFactory } from '@axisparkjs/telemetry';

/**
 * Creates the application. The OpenTelemetry SDK is started before, in `instrumentation.bootstrap.ts`, so the plugin exports to it.
 * @param port The HTTP port.
 * @param logTransports The log transports. The JSON entries include the trace_id and span_id of the active span.
 */
export const createApp = (port = 3000, logTransports: LogTransport[] = [new ConsoleTransport({ minLevel: LogLevel.Debug, formatter: new JsonFormatter() })]) => {
    const app = AxiSparkFactory.create({ name: 'Observability', basePath: __dirname, logTransports });

    app.use(
        TelemetryPlugin,
        TelemetryPluginOptionsFactory.create({
            // The health checks are scraped often and add noise to the traces.
            ignore: (context) => context.target.name === 'HealthController'
        })
    );
    app.use(SchedulePlugin);
    app.use(HttpPlugin, HttpPluginOptionsFactory.create({ port, basePath: '/api', healthChecks: true, rateLimit: true }));

    return app;
};
