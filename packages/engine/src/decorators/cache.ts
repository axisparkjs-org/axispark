import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { CacheConfiguration, CacheMetadata } from '../metadata';

function defineCache(metadata: CacheMetadata, target: object, propertyKey?: string | symbol): void {
    if (propertyKey !== undefined) Metadata.define(MetadataKeys.CACHE, metadata, target, propertyKey);
    else Metadata.define(MetadataKeys.CACHE, metadata, target);
}

/**
 * Caches the results of a handler, or of every handler of a class. While a result is valid, the next equal requests return it
 * without invoking the handler. The middlewares, guards and before interceptors still run on every request.
 * The cache is opt-in: a handler is never cached unless it, or its class, has this decorator.
 * @param options The time to live of the results and an optional custom key. The options of a method replace the options of its class.
 * @returns A cache decorator.
 * @throws An error when the `ttl` is not a number greater than 0.
 */
export function Cache(options: CacheConfiguration = {}): MethodDecorator & ClassDecorator {
    const ttl = options.ttl;
    if (ttl !== undefined && (typeof ttl !== 'number' || Number.isNaN(ttl) || ttl <= 0)) {
        throw new Error(`Invalid cache ttl '${ttl}': the ttl of @Cache() must be a number of milliseconds greater than 0.`);
    }

    return (target: object, propertyKey?: string | symbol) => {
        defineCache({ target: Metadata.normalizeTarget(target), propertyKey, disabled: false, options }, target, propertyKey);
    };
}

/**
 * Disables the cache of a handler, or of every handler of a class.
 * On a method, it disables the `@Cache()` of its class. On a class, it disables the cache of its handlers, unless a method has its own `@Cache()`.
 * @returns A no cache decorator.
 */
export function NoCache(): MethodDecorator & ClassDecorator {
    return (target: object, propertyKey?: string | symbol) => {
        defineCache({ target: Metadata.normalizeTarget(target), propertyKey, disabled: true }, target, propertyKey);
    };
}
