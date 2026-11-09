import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { CacheVaryMetadata } from '../metadata/cache-vary-metadata';

/**
 * Adds request headers to the cache key of a route, or of every route of a controller, decorated with `@Cache()`.
 * The requests with different values of these headers are cached separately, for example one entry per language with
 * `@CacheVary('accept-language')`. The headers of a method replace the headers of its class.
 * @param headers The names of the headers. They are case-insensitive.
 * @returns A cache vary decorator.
 */
export function CacheVary(...headers: string[]): MethodDecorator & ClassDecorator {
    return (target: object, propertyKey?: string | symbol) => {
        const metadata: CacheVaryMetadata = {
            target: Metadata.normalizeTarget(target),
            propertyKey,
            headers: [...new Set(headers.map((header) => header.toLowerCase()))].sort()
        };

        if (propertyKey !== undefined) Metadata.define(MetadataKeys.CACHE_VARY, metadata, target, propertyKey);
        else Metadata.define(MetadataKeys.CACHE_VARY, metadata, target);
    };
}
