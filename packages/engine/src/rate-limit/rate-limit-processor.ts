import { Processable } from '@axisparkjs/common';
import { Injectable } from '@axisparkjs/di';
import { ExecutionContext, ExecutionTransport } from '../execution';
import { instrumentStore, RateLimitDecision, RateLimitStore } from '@axisparkjs/store';
import { RateLimitDefinition } from './rate-limit-definition';
import { RateLimitResolver } from './rate-limit-resolver';
import { RateLimitInstrumentation } from './rate-limit-instrumentation';

/**
 * Applies rate limit definitions with the same algorithm for every transport. The resolver registered for the transport
 * identifies the client, and the requests are counted per transport, client and handler in a `RateLimitStore` with a sliding window.
 */
@Injectable()
export class RateLimitProcessor implements Processable {
    private static readonly resolvers = new Map<ExecutionTransport, RateLimitResolver>();
    private static readonly stores = new Map<ExecutionTransport, RateLimitStore>();
    private static instrumentation?: RateLimitInstrumentation;

    /** Registers the instrumentation that observes the decisions of every transport. Passing undefined removes it. */
    public static registerInstrumentation(instrumentation?: RateLimitInstrumentation): void {
        this.instrumentation = instrumentation;
    }

    /** Registers the resolver that identifies the clients of a transport. Passing undefined removes it. */
    public static registerRateLimit(transport: ExecutionTransport, resolver?: RateLimitResolver): void {
        if (resolver) this.resolvers.set(transport, resolver);
        else this.resolvers.delete(transport);
    }

    /**
     * Sets the store of the rate limit buckets of a transport. The plugins call it when they start, with the store created by the
     * `StoreProvider` of their options, which is `MemoryStore()` by default. Each transport keeps its own store, so a plugin never
     * replaces the store of another one, and the keys start with the transport, so two transports that share a store never share buckets.
     * Passing undefined removes it. The store is wrapped with `instrumentStore()`, so its operations can be observed.
     */
    public static registerRateLimitStore(transport: ExecutionTransport, store?: RateLimitStore): void {
        if (store) this.stores.set(transport, instrumentStore('rate-limit', store));
        else this.stores.delete(transport);
    }

    /**
     * Counts the request of the context against the definition.
     * @returns The decision, or `undefined` when there is no definition, or no resolver or no store is registered for the transport.
     */
    public async process(definition: RateLimitDefinition | undefined, context: ExecutionContext): Promise<RateLimitDecision | undefined> {
        if (!definition) return undefined;

        const resolver = RateLimitProcessor.resolvers.get(context.transport);
        const store = RateLimitProcessor.stores.get(context.transport);
        if (!resolver || !store) return undefined;

        const clientId = await resolver.resolve(context);
        const decision = await store.consume(this.getKey(context, clientId), definition);
        RateLimitProcessor.instrumentation?.decided(context, definition, decision);
        return decision;
    }

    /** Builds the bucket key with the transport, the client and the handler, so the key does not depend on the requested URL. */
    private getKey(context: ExecutionContext, clientId: string | undefined): string {
        return JSON.stringify([context.transport, clientId ?? 'unknown', context.target.name, String(context.propertyKey)]);
    }
}
