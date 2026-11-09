import { MetadataFromClassOrMethod } from '@axisparkjs/common';
import type { ExecutionContext } from '../execution';

/** Cache metadata declared on a class or method with `@Cache()` or `@NoCache()`. */
export interface CacheMetadata extends MetadataFromClassOrMethod {
    /** Whether the cache is disabled, as defined by `@NoCache()`. */
    disabled?: boolean;
    /** The options of `@Cache()`. */
    options?: CacheConfiguration;
}

/** Configurable parts of the cache of a handler. */
export interface CacheConfiguration {
    /** The time to live of the cached result in milliseconds. Defaults to the `cacheOptions.ttl` of the transport, or 60 seconds. */
    ttl?: number;
    /**
     * Builds the key from the context, replacing the key of the transport resolver. Use it to cache per user, for example.
     * Returning `undefined` does not cache the request.
     */
    key?: (context: ExecutionContext) => string | undefined;
}
