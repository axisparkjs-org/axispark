import { ClassType, Processable } from '@axisparkjs/common';
import { Injectable } from '@axisparkjs/di';
import { Logger } from '@axisparkjs/logger';
import { CacheStore } from '@axisparkjs/store';
import { ExecutionContext, ExecutionTransport } from '../execution';
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
 * `<transport>:<Class>.<method>:<generation>:<key>`, so two handlers never share entries.
 *
 * The generation of a handler is a counter kept in the store with the key `gen:<Class>.<method>`. `evict()` increments it, so the old
 * entries are never read again and expire with their time to live. It works with every `CacheStore`, without deleting keys by prefix.
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

    private readonly logger: Logger;

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

        const result = await invoke();
        if (result === undefined || result instanceof ResultDefinition) {
            const reason = result === undefined ? 'it is undefined' : `it is a ${result.constructor.name}`;
            await this.logger.debug(`The result of ${handler} is not cached because ${reason}`);
            return result;
        }

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
                const generation = await CacheProcessor.getGeneration(store, handler);
                await store.set(CacheProcessor.generationKey(handler), generation + 1);
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
        const generation = await store.get<number>(this.generationKey(handler));
        return typeof generation === 'number' ? generation : 0;
    }

    private static generationKey(handler: string): string {
        return `gen:${handler}`;
    }

    private static handlerOf(target: ClassType, propertyKey: string | symbol): string {
        return `${target.name}.${String(propertyKey)}`;
    }

    private static isEntry(entry: unknown): entry is CacheEntry {
        return typeof entry === 'object' && entry !== null && 'value' in entry;
    }
}
