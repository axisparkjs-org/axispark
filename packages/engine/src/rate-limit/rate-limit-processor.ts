import { Processable } from '@axisparkjs/common';
import { Injectable } from '@axisparkjs/di';
import { ExecutionContext, ExecutionTransport } from '../execution';
import { RateLimitDecision } from './rate-limit-decision';
import { RateLimitDefinition } from './rate-limit-definition';
import { RateLimitResolver } from './rate-limit-resolver';
import { InMemoryRateLimitStore, RateLimitStore } from './rate-limit-store';

/**
 * Applies rate limit definitions with the same algorithm for every transport. The resolver registered for the transport
 * identifies the client, and the requests are counted per transport, client and handler in a `RateLimitStore` with a sliding window.
 */
@Injectable()
export class RateLimitProcessor implements Processable {
    private static readonly resolvers = new Map<ExecutionTransport, RateLimitResolver>();
    private static store: RateLimitStore = new InMemoryRateLimitStore();

    /** Registers the resolver that identifies the clients of a transport. Passing undefined removes it. */
    public static registerRateLimit(transport: ExecutionTransport, resolver?: RateLimitResolver): void {
        if (resolver) this.resolvers.set(transport, resolver);
        else this.resolvers.delete(transport);
    }

    /** Sets the store of the rate limit buckets. Passing undefined restores a new `InMemoryRateLimitStore`. */
    public static registerRateLimitStore(store?: RateLimitStore): void {
        this.store = store ?? new InMemoryRateLimitStore();
    }

    /**
     * Counts the request of the context against the definition.
     * @returns The decision, or `undefined` when there is no definition or no resolver is registered for the transport.
     */
    public async process(definition: RateLimitDefinition | undefined, context: ExecutionContext): Promise<RateLimitDecision | undefined> {
        if (!definition) return undefined;

        const resolver = RateLimitProcessor.resolvers.get(context.transport);
        if (!resolver) return undefined;

        const clientId = await resolver.resolve(context);
        return await RateLimitProcessor.store.consume(this.getKey(context, clientId), definition);
    }

    /** Builds the bucket key with the transport, the client and the handler, so the key does not depend on the requested URL. */
    private getKey(context: ExecutionContext, clientId: string | undefined): string {
        return JSON.stringify([context.transport, clientId ?? 'unknown', context.target.name, String(context.propertyKey)]);
    }
}
