import { RateLimitDecision } from '@axisparkjs/store';
import type { ExecutionContext } from '../execution';
import { RateLimitDefinition } from './rate-limit-definition';

/**
 * Observes the decisions of the rate limits of every transport, such as `@axisparkjs/telemetry`, which counts the rejected requests.
 * Register it with `RateLimitProcessor.registerInstrumentation()`.
 */
export interface RateLimitInstrumentation {
    /**
     * Called after a request is counted.
     * @param context The execution context of the request.
     * @param definition The rate limit of the handler.
     * @param decision Whether the request is allowed.
     */
    decided(context: ExecutionContext, definition: RateLimitDefinition, decision: RateLimitDecision): void;
}
