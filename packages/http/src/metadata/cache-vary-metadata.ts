import { MetadataFromClassOrMethod } from '@axisparkjs/common';

/** The request headers added to the cache key of a controller or route by `@CacheVary()`. */
export interface CacheVaryMetadata extends MetadataFromClassOrMethod {
    /** The names of the headers, in lower case. */
    headers: string[];
}
