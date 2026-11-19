import { InMemoryCacheStore, InMemoryCacheStoreOptions } from '../cache';
import { StoreKindNotSupportedError } from '../errors';
import { InMemoryLockStore } from '../lock';
import { InMemoryRateLimitStore } from '../rate-limit';
import { StoreKind, StoreProvider, StoreTypes } from '../store-provider';

/** The kinds of store implemented by `MemoryStore`. */
export type MemoryStoreKind = 'rate-limit' | 'lock' | 'cache';

/** Options of the in-memory stores created by `MemoryStore()`. */
export interface MemoryStoreOptions {
    /** The options of the cache stores, such as the maximum number of values (`maxEntries`, 10 000 by default). */
    cache?: InMemoryCacheStoreOptions;
}

const factories: { [K in MemoryStoreKind]: (options: MemoryStoreOptions) => StoreTypes[K] } = {
    'rate-limit': () => new InMemoryRateLimitStore(),
    lock: () => new InMemoryLockStore(),
    cache: (options) => new InMemoryCacheStore(options.cache)
};

/**
 * Creates the provider of the in-memory stores, which is the default store of every feature.
 * The stores are local to the application process: use a shared provider, such as `RedisStore` from `@axisparkjs/redis`,
 * when several instances of the application must share them.
 * @param options The options of the stores, such as `{ cache: { maxEntries: 50_000 } }`.
 * @returns A provider that creates a new in-memory store each time it is called.
 */
export function MemoryStore(options: MemoryStoreOptions = {}): StoreProvider<MemoryStoreKind> {
    const provider = (kind: StoreKind) => {
        const factory = factories[kind as MemoryStoreKind] as ((options: MemoryStoreOptions) => StoreTypes[MemoryStoreKind]) | undefined;
        if (!factory) throw new StoreKindNotSupportedError('MemoryStore', kind);
        return factory(options);
    };
    return provider as StoreProvider<MemoryStoreKind>;
}
