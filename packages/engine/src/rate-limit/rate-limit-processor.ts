import { Processable } from '@axisparkjs/common';
import { Injectable } from '@axisparkjs/di';
import { ExecutionContext, ExecutionTransport } from '../execution';
import { RateLimitDefinition } from './rate-limit-definition';
import { RateLimitDecision, RateLimitResolver } from './rate-limit-resolver';

/** Dispatches rate limit definitions to resolvers registered for each transport. */
@Injectable()
export class RateLimitProcessor implements Processable {
    private static readonly resolvers = new Map<ExecutionTransport, RateLimitResolver>();

    /** Registers a transport-specific rate limit resolver. Passing undefined removes it. */
    public static registerRateLimit(transport: ExecutionTransport, resolver?: RateLimitResolver): void {
        if (resolver) this.resolvers.set(transport, resolver);
        else this.resolvers.delete(transport);
    }

    /** Resolves a definition using the resolver for the execution transport. */
    public async process(definition: RateLimitDefinition | undefined, context: ExecutionContext): Promise<RateLimitDecision | undefined> {
        if (!definition) return undefined;

        const resolver = RateLimitProcessor.resolvers.get(context.transport);
        if (!resolver) return undefined;

        return await resolver.resolve(definition, context);
    }
}
