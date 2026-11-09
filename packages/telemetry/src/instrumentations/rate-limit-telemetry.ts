import { ExecutionContext, RateLimitDefinition, RateLimitInstrumentation } from '@axisparkjs/engine';
import { RateLimitDecision } from '@axisparkjs/store';
import { Counter, Meter, trace } from '@opentelemetry/api';
import { TelemetryAttributes as A, TelemetryMetrics } from '../telemetry-names';

/** Counts the requests rejected by the rate limits of every transport, and adds an event to the active span. */
export class RateLimitTelemetry implements RateLimitInstrumentation {
    private readonly rejections: Counter;

    constructor(meter: Meter) {
        this.rejections = meter.createCounter(TelemetryMetrics.RATE_LIMIT_REJECTIONS, { description: 'The requests rejected by the rate limits.' });
    }

    public decided(context: ExecutionContext, definition: RateLimitDefinition, decision: RateLimitDecision): void {
        if (decision.allowed) return;

        const attributes = { [A.TRANSPORT]: context.transport, [A.HANDLER]: `${context.target.name}.${String(context.propertyKey)}` };
        this.rejections.add(1, attributes);
        trace.getActiveSpan()?.addEvent('rate_limit.rejected', { limit: definition.limit, ttl: definition.ttl, retry_after_ms: decision.retryAfterMs });
    }
}
