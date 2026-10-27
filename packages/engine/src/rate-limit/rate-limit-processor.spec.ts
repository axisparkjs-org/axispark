import { ExecutionContext, ExecutionTransport } from '../execution';
import { RateLimitDefinition } from './rate-limit-definition';
import { RateLimitProcessor } from './rate-limit-processor';
import { RateLimitResolver } from './rate-limit-resolver';

describe('RateLimitProcessor', () => {
    let processor: RateLimitProcessor;
    const context = (transport = ExecutionTransport.Http) => ({ transport }) as ExecutionContext;

    beforeEach(() => {
        processor = new RateLimitProcessor();
        (RateLimitProcessor as any).resolvers.clear();
    });

    it('dispatches the definition to the resolver registered for the context transport', async () => {
        const definition = new RateLimitDefinition(1_000, 3);
        const decision = { allowed: false, retryAfterMs: 500 };
        const resolver: RateLimitResolver = { resolve: jest.fn().mockReturnValue(decision) };
        RateLimitProcessor.registerRateLimit(ExecutionTransport.Http, resolver);

        await expect(processor.process(definition, context())).resolves.toBe(decision);
        expect(resolver.resolve).toHaveBeenCalledWith(definition, expect.objectContaining({ transport: ExecutionTransport.Http }));
    });

    it('returns undefined when there is no rate limit definition', async () => {
        const resolver: RateLimitResolver = { resolve: jest.fn() };
        RateLimitProcessor.registerRateLimit(ExecutionTransport.Http, resolver);

        await expect(processor.process(undefined, context())).resolves.toBeUndefined();
        expect(resolver.resolve).not.toHaveBeenCalled();
    });

    it('returns undefined when no resolver is registered for the transport', async () => {
        await expect(processor.process(new RateLimitDefinition(1_000, 3), context())).resolves.toBeUndefined();
    });

    it('keeps resolvers isolated by transport and supports unregistering', async () => {
        const resolver: RateLimitResolver = { resolve: jest.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }) };
        const definition = new RateLimitDefinition(1_000, 3);
        RateLimitProcessor.registerRateLimit(ExecutionTransport.Http, resolver);

        await expect(processor.process(definition, context(ExecutionTransport.WebSocket))).resolves.toBeUndefined();
        RateLimitProcessor.registerRateLimit(ExecutionTransport.Http);
        await expect(processor.process(definition, context())).resolves.toBeUndefined();
    });
});
