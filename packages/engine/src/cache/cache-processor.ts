import { ClassType, Processable } from '@axisparkjs/common';
import { Injectable } from '@axisparkjs/di';
import { Logger } from '@axisparkjs/logger';
import { CacheStore } from '@axisparkjs/store';
import { ClassIdentifier, ExecutionContext, ExecutionTransport } from '../execution';
import { ResultDefinition } from '../result';
import { CacheDefinition } from './cache-definition';
import { CacheResolver } from './cache-resolver';

/** The value kept in the store, wrapped so a cached `null` or `false` is not confused with a missing entry. */
interface CacheEntry {
    value: unknown;
}

/**
 * Caches the results of the handlers with the same algorithm for every transport. The resolver registered for the transport builds the key
 * of the request, and the results are kept in the `CacheStore` registered for the transport with the key
 * `<transport>:<Class>.<method>:<generation>:<key>`, so two handlers never share entries. `<Class>` is the `ClassIdentifier` of the class, so
 * two classes with the same name never share entries either.
 *
 * The generation of a handler is a counter kept in the store with the key `gen:<Class>.<method>`. `evict()` increments it, so the old
 * entries are never read again and expire with their time to live. It works with every `CacheStore`, without deleting keys by prefix.
 * The generation read from each store is kept in memory for one second by default (see `setGenerationTtl()`), so a cache hit costs one
 * store read instead of two. `evict()` updates the generation kept in memory immediately, so the process that evicts never reads the old
 * entries; other processes that share the store (such as replicas with Redis) read the new generation when their copy expires.
 *
 * When several requests of the same process miss the same key at the same time, only the first one invokes the handler, and the others
 * wait for it and receive its result (single-flight), so a popular entry that expires does not run the handler once per request. When the
 * first invocation fails or its result is not cached, the waiting requests invoke the handler themselves.
 *
 * The cache is an optimization: when the store fails, the handler runs as if the result was not cached, and a warning is logged at most
 * once a minute for each transport.
 */
@Injectable()
export class CacheProcessor implements Processable {
    private static readonly WARNING_INTERVAL = 60_000;
    private static readonly resolvers = new Map<ExecutionTransport, CacheResolver>();
    private static readonly stores = new Map<ExecutionTransport, CacheStore>();
    private static readonly lastWarnings = new Map<ExecutionTransport, number>();
    private static readonly generations = new WeakMap<CacheStore, Map<string, { generation: number; expiresAt: number }>>();
    private static generationTtl = 1_000;

    private readonly logger: Logger;
    private readonly pending = new Map<string, Promise<CacheEntry | undefined>>();

    constructor(logger: Logger) {
        this.logger = logger.child('CacheProcessor');
    }

    /** Registers the resolver that builds the cache keys of a transport. Passing undefined removes it. */
    public static registerCache(transport: ExecutionTransport, resolver?: CacheResolver): void {
        if (resolver) this.resolvers.set(transport, resolver);
        else this.resolvers.delete(transport);
    }

    /**
     * Sets the store of the cached results of a transport. The plugins call it when they start, with the store created by the
     * `StoreProvider` of their options, which is `MemoryStore()` by default. Each transport keeps its own store, and the keys start
     * with the transport, so two transports that share a store never share entries. Passing undefined removes it.
     */
    public static registerCacheStore(transport: ExecutionTransport, store?: CacheStore): void {
        if (store) this.stores.set(transport, store);
        else this.stores.delete(transport);
    }

    /**
     * Sets how long, in milliseconds, the generation of a handler read from a store is kept in memory before it is read again. It is
     * the longest time that another process that shares the store keeps reading the entries evicted by `evict()` without a key. `0`
     * reads the generation from the store on every request. The default is `1000`.
     * @param ttl The time to live of the generations kept in memory, in milliseconds.
     */
    public static setGenerationTtl(ttl: number): void {
        this.generationTtl = Math.max(0, ttl);
    }

    /**
     * Returns the cached result of the request of the context or, when there is none, invokes the handler and caches its result.
     * Only plain results are cached: `undefined`, the `ResultDefinition` instances (such as files, streams or redirects) and the errors are not.
     * @param definition The cache of the handler, or `undefined` when it is not cached.
     * @param context The execution context of the request.
     * @param invoke Invokes the handler and returns its result.
     * @returns The cached result, or the result of the handler.
     */
    public async process(definition: CacheDefinition | undefined, context: ExecutionContext, invoke: () => Promise<unknown>): Promise<unknown> {
        if (!definition) return await invoke();

        const resolver = CacheProcessor.resolvers.get(context.transport);
        const store = CacheProcessor.stores.get(context.transport);
        if (!resolver || !store) return await invoke();

        const requestKey = await resolver.resolve(context, definition);
        if (requestKey === undefined) return await invoke();

        const handler = CacheProcessor.handlerOf(context.target, context.propertyKey);
        let key: string | undefined;
        try {
            key = await this.getKey(store, context.transport, handler, requestKey);
            const entry = await store.get<CacheEntry>(key);
            if (CacheProcessor.isEntry(entry)) return entry.value;
        } catch (error) {
            await this.warn(context.transport, error);
            return await invoke();
        }

        const pending = this.pending.get(key);
        if (pending) {
            const shared = await pending;
            return shared ? shared.value : await invoke();
        }

        let result: unknown;
        let share!: (entry: CacheEntry | undefined) => void;
        this.pending.set(
            key,
            new Promise<CacheEntry | undefined>((resolve) => {
                share = resolve;
            })
        );
        try {
            result = await invoke();
        } catch (error) {
            share(undefined);
            throw error;
        } finally {
            this.pending.delete(key);
        }

        if (result === undefined || result instanceof ResultDefinition) {
            share(undefined);
            const reason = result === undefined ? 'it is undefined' : `it is a ${result.constructor.name}`;
            await this.logger.debug(`The result of ${handler} is not cached because ${reason}`);
            return result;
        }

        share({ value: result });
        try {
            await store.set<CacheEntry>(key, { value: result }, definition.ttl);
        } catch (error) {
            await this.warn(context.transport, error);
        }

        return result;
    }

    /**
     * Evicts the cached results of a handler from the stores of every transport.
     * @param target The class of the handler.
     * @param propertyKey The method of the handler.
     * @param key The key of one request, as returned by the resolver of the transport or the custom `key` of `@Cache()`.
     * Without it, every result of the handler is evicted by incrementing its generation.
     */
    public async evict(target: ClassType, propertyKey: string | symbol, key?: string): Promise<void> {
        const handler = CacheProcessor.handlerOf(target, propertyKey);

        if (key === undefined) {
            for (const store of new Set(CacheProcessor.stores.values())) {
                const generation = await CacheProcessor.readGeneration(store, handler);
                await store.set(CacheProcessor.generationKey(handler), generation + 1);
                CacheProcessor.keepGeneration(store, handler, generation + 1);
            }
            return;
        }

        for (const [transport, store] of CacheProcessor.stores) {
            await store.delete(await this.getKey(store, transport, handler, key));
        }
    }

    private async getKey(store: CacheStore, transport: ExecutionTransport, handler: string, key: string): Promise<string> {
        const generation = await CacheProcessor.getGeneration(store, handler);
        return `${transport}:${handler}:${generation}:${key}`;
    }

    private async warn(transport: ExecutionTransport, error: unknown): Promise<void> {
        const now = Date.now();
        const last = CacheProcessor.lastWarnings.get(transport);
        if (last !== undefined && now - last < CacheProcessor.WARNING_INTERVAL) return;

        CacheProcessor.lastWarnings.set(transport, now);
        await this.logger.warn(
            `The ${transport} cache store failed, so the handlers run without cache: ${error instanceof Error ? error.message : String(error)}`
        );
    }

    private static async getGeneration(store: CacheStore, handler: string): Promise<number> {
        const kept = this.generations.get(store)?.get(handler);
        if (kept && kept.expiresAt > Date.now()) return kept.generation;

        const generation = await this.readGeneration(store, handler);
        this.keepGeneration(store, handler, generation);
        return generation;
    }

    private static async readGeneration(store: CacheStore, handler: string): Promise<number> {
        const generation = await store.get<number>(this.generationKey(handler));
        return typeof generation === 'number' ? generation : 0;
    }

    private static keepGeneration(store: CacheStore, handler: string, generation: number): void {
        let generations = this.generations.get(store);
        if (!generations) {
            generations = new Map();
            this.generations.set(store, generations);
        }
        generations.set(handler, { generation, expiresAt: Date.now() + this.generationTtl });
    }

    private static generationKey(handler: string): string {
        return `gen:${handler}`;
    }

    private static handlerOf(target: ClassType, propertyKey: string | symbol): string {
        return `${ClassIdentifier.of(target)}.${String(propertyKey)}`;
    }

    private static isEntry(entry: unknown): entry is CacheEntry {
        return typeof entry === 'object' && entry !== null && 'value' in entry;
    }
}
