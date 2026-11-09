import { HealthEngine, HealthStatus } from '@axisparkjs/core';
import { BatchObservableCallback, Meter, ObservableGauge } from '@opentelemetry/api';
import { TelemetryAttributes as A, TelemetryMetrics } from '../telemetry-names';

/**
 * Reports the status of the application, its plugins and its health checks as a gauge: `1` when it is healthy and `0` otherwise.
 * The health checks run when the metrics are collected, for example every time Prometheus scrapes them.
 */
export class HealthTelemetry {
    private readonly gauge: ObservableGauge;
    private readonly callback: BatchObservableCallback;

    constructor(
        private readonly meter: Meter,
        healthEngine: HealthEngine
    ) {
        this.gauge = meter.createObservableGauge(TelemetryMetrics.HEALTH_STATUS, { description: 'The status of the health checks: 1 (up) or 0 (down).' });
        this.callback = async (result) => {
            const healthData = await healthEngine.checkAll();
            for (const data of healthData) {
                result.observe(this.gauge, data.status === HealthStatus.Healthy ? 1 : 0, { [A.HEALTH_CHECK]: data.component });
            }
        };
        meter.addBatchObservableCallback(this.callback, [this.gauge]);
    }

    /** Stops reporting the gauge. */
    public dispose(): void {
        this.meter.removeBatchObservableCallback(this.callback, [this.gauge]);
    }
}
