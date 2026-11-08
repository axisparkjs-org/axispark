import { Processable } from '@axisparkjs/common';
import { Injectable } from '@axisparkjs/di';
import { ExecutionContext, ExecutionTransport } from '../execution';
import { RateLimitDecision, RateLimitStore } from '@axisparkjs/store';
import { RateLimitDefinition } from './rate-limit-definition';
import { RateLimitResolver } from './rate-limit-resolver';

/**
 * Applies rate limit definitions with the same algorithm for every transport. The resolver registered for the transport
 * identifies the client, and the requests are counted per transport, client and handler in a `RateLimitStore` with a sliding window.
 */
@Injectable()
export class RateLimitProcessor implements Processable {
    private static readonly resolvers = new Map<ExecutionTransport, RateLimitResolver>();
    private static store?: RateLimitStore;

    /** Registers the resolver that identifies the clients of a transport. Passing undefined removes it. */
    public static registerRateLimit(transport: ExecutionTransport, resolver?: RateLimitResolver): void {
        if (resolver) this.resolvers.set(transport, resolver);
        else this.resolvers.delete(transport);
    }

    /**
     * Sets the store of the rate limit buckets. The plugins call it when they start, with the store created by the
     * `StoreProvider` of their options, which is `MemoryStore()` by default.
     */
    public static registerRateLimitStore(store: RateLimitStore): void {
        this.store = store;
    }

    /**
     * Counts the request of the context against the definition.
     * @returns The decision, or `undefined` when there is no definition, no resolver is registered for the transport or no store is registered.
     */
    public async process(definition: RateLimitDefinition | undefined, context: ExecutionContext): Promise<RateLimitDecision | undefined> {
        if (!definition) return undefined;

        const resolver = RateLimitProcessor.resolvers.get(context.transport);
        const store = RateLimitProcessor.store;
        if (!resolver || !store) return undefined;

        const clientId = await resolver.resolve(context);
        return await store.consume(this.getKey(context, clientId), definition);
    }

    /** Builds the bucket key with the transport, the client and the handler, so the key does not depend on the requested URL. */
    private getKey(context: ExecutionContext, clientId: string | undefined): string {
        return JSON.stringify([context.transport, clientId ?? 'unknown', context.target.name, String(context.propertyKey)]);
    }
}
