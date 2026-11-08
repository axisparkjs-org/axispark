import { RateLimitPolicy } from '@axisparkjs/store';

/** A transport-independent rate limit policy. */
export class RateLimitDefinition implements RateLimitPolicy {
    constructor(
        public readonly ttl: number,
        public readonly limit: number
    ) {}
}
