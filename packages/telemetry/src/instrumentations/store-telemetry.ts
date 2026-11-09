import { StoreInstrumentation, StoreOperation } from '@axisparkjs/store';
import { Histogram, Meter } from '@opentelemetry/api';
import { errorType, secondsSince, TelemetryAttributes as A, TelemetryMetrics } from '../telemetry-names';

/** Records the duration of the operations of the stores used by the framework: rate limits, locks and caches. */
export class StoreTelemetry implements StoreInstrumentation {
    private readonly duration: Histogram;

    constructor(meter: Meter) {
        this.duration = meter.createHistogram(TelemetryMetrics.STORE_OPERATION_DURATION, { description: 'The duration of the store operations.', unit: 's' });
    }

    public start(operation: StoreOperation): (error?: unknown) => void {
        const start = performance.now();
        return (error?: unknown) => {
            this.duration.record(secondsSince(start), {
                [A.STORE_KIND]: operation.kind,
                [A.STORE_OPERATION]: operation.operation,
                ...(error === undefined ? {} : { [A.ERROR_TYPE]: errorType(error) })
            });
        };
    }
}
