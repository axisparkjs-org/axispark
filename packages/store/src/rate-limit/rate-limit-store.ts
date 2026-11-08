import { RateLimitDecision } from './rate-limit-decision';

/** The time window and the maximum number of requests of a rate limit. */
export interface RateLimitPolicy {
    /** The sliding time window in milliseconds. */
    readonly ttl: number;
    /** The maximum number of requests allowed in the window. */
    readonly limit: number;
}

/**
 * Stores the requests counted by the rate limits and applies the sliding window of a policy.
 * Use a shared store, such as `RedisStore` from `@axisparkjs/redis`, to share the limits between several instances of the application.
 */
export interface RateLimitStore {
    /**
     * Counts a request in the bucket of the key when the limit of the policy allows it.
     * @param key The bucket key, which identifies the transport, the client and the handler.
     * @param policy The time window (`ttl`) and the maximum number of requests (`limit`).
     * @returns Whether the request is allowed and, when it is not, the milliseconds until the oldest request leaves the window.
     */
    consume(key: string, policy: RateLimitPolicy): RateLimitDecision | Promise<RateLimitDecision>;
}
