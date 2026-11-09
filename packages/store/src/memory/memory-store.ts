import { InMemoryCacheStore } from '../cache';
import { StoreKindNotSupportedError } from '../errors';
import { InMemoryLockStore } from '../lock';
import { InMemoryRateLimitStore } from '../rate-limit';
import { StoreKind, StoreProvider, StoreTypes } from '../store-provider';

/** The kinds of store implemented by `MemoryStore`. */
export type MemoryStoreKind = 'rate-limit' | 'lock' | 'cache';

const factories: { [K in MemoryStoreKind]: () => StoreTypes[K] } = {
    'rate-limit': () => new InMemoryRateLimitStore(),
    lock: () => new InMemoryLockStore(),
    cache: () => new InMemoryCacheStore()
};

/**
 * Creates the provider of the in-memory stores, which is the default store of every feature.
 * The stores are local to the application process: use a shared provider, such as `RedisStore` from `@axisparkjs/redis`,
 * when several instances of the application must share them.
 * @returns A provider that creates a new in-memory store each time it is called.
 */
export function MemoryStore(): StoreProvider<MemoryStoreKind> {
    const provider = (kind: StoreKind) => {
        const factory = factories[kind as MemoryStoreKind] as (() => StoreTypes[MemoryStoreKind]) | undefined;
        if (!factory) throw new StoreKindNotSupportedError('MemoryStore', kind);
        return factory();
    };
    return provider as StoreProvider<MemoryStoreKind>;
}
