import { InMemoryCacheStore } from '../cache';
import { StoreKindNotSupportedError } from '../errors';
import { InMemoryLockStore } from '../lock';
import { InMemoryRateLimitStore } from '../rate-limit';
import { StoreContext, StoreProvider } from '../store-provider';
import { MemoryStore, MemoryStoreKind } from './memory-store';

describe('MemoryStore', () => {
    const context = {} as StoreContext;

    it.each([
        ['rate-limit', InMemoryRateLimitStore],
        ['lock', InMemoryLockStore],
        ['cache', InMemoryCacheStore]
    ] as const)('creates an in-memory %s store', (kind, type) => {
        const provider = MemoryStore() as (kind: MemoryStoreKind, context: StoreContext) => unknown;

        expect(provider(kind, context)).toBeInstanceOf(type);
    });

    it('creates a new store each time it is called', () => {
        const provider = MemoryStore();

        expect(provider('lock', context)).not.toBe(provider('lock', context));
    });

    it('can be used where a single kind is required', () => {
        const provider: StoreProvider<'rate-limit'> = MemoryStore();

        expect(provider('rate-limit', context)).toBeInstanceOf(InMemoryRateLimitStore);
    });

    it('throws an error for an unsupported kind', () => {
        const provider = MemoryStore() as unknown as (kind: string, context: StoreContext) => unknown;

        expect(() => provider('session', context)).toThrow(StoreKindNotSupportedError);
    });
});
