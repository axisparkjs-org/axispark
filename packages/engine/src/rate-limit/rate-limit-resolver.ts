import { Resolver } from '@axisparkjs/common';
import { ExecutionContext } from '../execution';
import { RateLimitDefinition } from './rate-limit-definition';

/** The result of checking a request against a rate limit. */
export interface RateLimitDecision {
    allowed: boolean;
    retryAfterMs: number;
}

/** Resolves a rate limit using the identity and state of a specific transport. */
export interface RateLimitResolver extends Resolver<RateLimitDecision> {
    resolve(definition: RateLimitDefinition, context: ExecutionContext): RateLimitDecision | Promise<RateLimitDecision>;
}
