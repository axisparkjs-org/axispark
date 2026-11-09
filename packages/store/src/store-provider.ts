import { Container } from '@axisparkjs/di';
import { Logger } from '@axisparkjs/logger';
import { CacheStore } from './cache';
import { LockStore } from './lock';
import { RateLimitStore } from './rate-limit';

/**
 * Maps each store kind to its contract. A `StoreProvider` receives one of these kinds and returns the matching store.
 *
 * Packages add their own kinds with declaration merging:
 * ```ts
 * declare module '@axisparkjs/store' {
 *     interface StoreTypes {
 *         session: SessionStore;
 *     }
 * }
 * ```
 */
export interface StoreTypes {
    /** The buckets counted by the rate limits. */
    'rate-limit': RateLimitStore;
    /** The locks that coordinate several instances, such as the exclusive jobs of the scheduler. */
    lock: LockStore;
    /** Values cached with an optional expiration. */
    cache: CacheStore;
}

/** The kind of a store, such as `'rate-limit'` or `'lock'`. */
export type StoreKind = keyof StoreTypes;

/**
 * What a provider receives to create a store. The `AxiSparkContext` satisfies it, so plugins pass their context as it is.
 */
export interface StoreContext {
    /** The container of the application, used to resolve the connections of the backend. */
    readonly container: Container;
    /** The logger of the application. */
    readonly logger: Logger;
}

/** Creates the store of one kind. */
export type StoreFactory<K extends StoreKind> = (kind: K, context: StoreContext) => StoreTypes[K] | Promise<StoreTypes[K]>;

/** Converts a union, such as the factories of several kinds, into an intersection, which is a function with one signature per kind. */
export type UnionToIntersection<U> = (U extends unknown ? (value: U) => void : never) extends (value: infer I) => void ? I : never;

/**
 * Creates the store of the requested kind. Plugins call the provider when they start, with the kind of store they need.
 *
 * `K` is the set of kinds that the provider supports: the provider has one signature per kind, so passing a provider
 * where an unsupported kind is required is a compile error. A function that creates a single kind of store,
 * such as `() => new MyRateLimitStore()`, is also a valid `StoreProvider<'rate-limit'>`.
 */
export type StoreProvider<K extends StoreKind = StoreKind> = UnionToIntersection<K extends StoreKind ? StoreFactory<K> : never>;
