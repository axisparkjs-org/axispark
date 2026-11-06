/** The result of checking a request against a rate limit. */
export interface RateLimitDecision {
    /** Whether the request is allowed. */
    allowed: boolean;
    /** Milliseconds until the oldest counted request leaves the window. `0` when the request is allowed. */
    retryAfterMs: number;
}
