import { Resolver } from '@axisparkjs/common';
import type { ExecutionContext } from '../execution';
import { CacheDefinition } from './cache-definition';

/**
 * Builds the cache key of a request from the context of a specific transport, such as the method, host, path and query of an HTTP request.
 * `CacheProcessor` adds the transport, the handler and its generation to the key, so the resolver only describes the request.
 * Returning `undefined` does not cache the request, for example an HTTP `POST`.
 */
export interface CacheResolver extends Resolver<string | undefined> {
    /**
     * Resolves the key of the request.
     * @param context The execution context of the request.
     * @param definition The cache of the handler. When it has a custom `key`, the resolver uses it instead of its own key.
     * @returns The key, or `undefined` when the request cannot be cached.
     */
    resolve(context: ExecutionContext, definition: CacheDefinition): string | undefined | Promise<string | undefined>;
}
