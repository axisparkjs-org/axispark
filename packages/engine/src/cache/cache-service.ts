import { ClassType } from '@axisparkjs/common';
import { Injectable } from '@axisparkjs/di';
import { CacheProcessor } from './cache-processor';

/**
 * Evicts the cached results of the handlers decorated with `@Cache()`. Inject it in the services that change the data:
 * ```ts
 * await this.cache.evict(ProductController, 'find'); // every entry of the handler
 * await this.cache.evict(ProductController, 'find', key); // one entry
 * ```
 */
@Injectable()
export class CacheService {
    constructor(private readonly processor: CacheProcessor) {}

    /**
     * Evicts the cached results of a handler in every transport.
     * @param target The class of the handler, such as a controller.
     * @param propertyKey The name of the method of the handler.
     * @param key The key of one request, as returned by the resolver of the transport or the custom `key` of `@Cache()`.
     * Without it, every result of the handler is evicted. The old entries are never read again and expire with their time to live.
     */
    public async evict<T>(target: ClassType<T>, propertyKey: (keyof T & string) | symbol, key?: string): Promise<void> {
        await this.processor.evict(target, propertyKey, key);
    }
}
