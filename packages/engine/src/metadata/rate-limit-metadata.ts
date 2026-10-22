import { MetadataFromClassOrMethod } from '@axisparkjs/common';

/** Rate limit metadata declared on a class or method. */
export interface RateLimitMetadata extends MetadataFromClassOrMethod {
    disabled?: boolean;
    options?: RateLimitConfiguration;
}

/** Configurable parts of a rate limit policy. */
export interface RateLimitConfiguration {
    /** The sliding time window in milliseconds. */
    ttl?: number;
    /** The maximum number of requests allowed in the window. */
    limit?: number;
}
