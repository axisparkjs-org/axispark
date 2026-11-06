import { ExecutionContext, ExecutionTransport } from '../execution';
import { RateLimitDefinition } from './rate-limit-definition';
import { RateLimitProcessor } from './rate-limit-processor';
import { RateLimitResolver } from './rate-limit-resolver';
import { InMemoryRateLimitStore, RateLimitStore } from './rate-limit-store';

describe('RateLimitProcessor', () => {
    let processor: RateLimitProcessor;
    let now: number;
    class TestController {}
    class AnotherController {}

    const context = (transport = ExecutionTransport.Http, target: object = TestController, propertyKey = 'handle', path = '/items') =>
        ({ transport, target, propertyKey, request: { path } }) as unknown as ExecutionContext;
    const resolverOf = (clientId?: string): RateLimitResolver => ({ resolve: jest.fn().mockReturnValue(clientId) });

    beforeEach(() => {
        now = 10_000;
        jest.spyOn(Date, 'now').mockImplementation(() => now);
        processor = new RateLimitProcessor();
        (RateLimitProcessor as any).resolvers.clear();
        RateLimitProcessor.registerRateLimitStore();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('identifies the client with the resolver registered for the context transport', async () => {
        const resolver = resolverOf('127.0.0.1');
        RateLimitProcessor.registerRateLimit(ExecutionTransport.Http, resolver);

        await expect(processor.process(new RateLimitDefinition(1_000, 3), context())).resolves.toEqual({ allowed: true, retryAfterMs: 0 });
        expect(resolver.resolve).toHaveBeenCalledWith(expect.objectContaining({ transport: ExecutionTransport.Http }));
    });

    it('applies the sliding window of the definition', async () => {
        const definition = new RateLimitDefinition(1_000, 2);
        RateLimitProcessor.registerRateLimit(ExecutionTransport.Http, resolverOf('127.0.0.1'));

        await expect(processor.process(definition, context())).resolves.toEqual({ allowed: true, retryAfterMs: 0 });
        now += 200;
        await expect(processor.process(definition, context())).resolves.toEqual({ allowed: true, retryAfterMs: 0 });
        now += 300;
        await expect(processor.process(definition, context())).resolves.toEqual({ allowed: false, retryAfterMs: 500 });
        now += 500;
        await expect(processor.process(definition, context())).resolves.toEqual({ allowed: true, retryAfterMs: 0 });
    });

    it('isolates counters by transport, client and handler', async () => {
        const definition = new RateLimitDefinition(1_000, 1);
        const resolver = { resolve: jest.fn().mockReturnValue('client-1') };
        RateLimitProcessor.registerRateLimit(ExecutionTransport.Http, resolver);
        RateLimitProcessor.registerRateLimit(ExecutionTransport.WebSocket, resolver);

        expect((await processor.process(definition, context()))?.allowed).toBe(true);
        expect((await processor.process(definition, context(ExecutionTransport.WebSocket)))?.allowed).toBe(true);
        expect((await processor.process(definition, context(ExecutionTransport.Http, TestController, 'other')))?.allowed).toBe(true);
        expect((await processor.process(definition, context(ExecutionTransport.Http, AnotherController)))?.allowed).toBe(true);
        resolver.resolve.mockReturnValueOnce('client-2');
        expect((await processor.process(definition, context()))?.allowed).toBe(true);

        expect((await processor.process(definition, context()))?.allowed).toBe(false);
    });

    it('shares the counter of a handler whatever the requested URL', async () => {
        const definition = new RateLimitDefinition(1_000, 2);
        RateLimitProcessor.registerRateLimit(ExecutionTransport.Http, resolverOf('127.0.0.1'));

        expect((await processor.process(definition, context(ExecutionTransport.Http, TestController, 'user', '/users/1')))?.allowed).toBe(true);
        expect((await processor.process(definition, context(ExecutionTransport.Http, TestController, 'user', '/users/2')))?.allowed).toBe(true);
        expect((await processor.process(definition, context(ExecutionTransport.Http, TestController, 'user', '/users/1?a=1')))?.allowed).toBe(false);
    });

    it('counts the requests without a client identifier in a shared bucket', async () => {
        const definition = new RateLimitDefinition(1_000, 1);
        RateLimitProcessor.registerRateLimit(ExecutionTransport.Http, { resolve: jest.fn().mockResolvedValue(undefined) });

        expect((await processor.process(definition, context()))?.allowed).toBe(true);
        expect((await processor.process(definition, context()))?.allowed).toBe(false);
    });

    it('builds the bucket key with the transport, the client and the handler', async () => {
        const store: RateLimitStore = { consume: jest.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }) };
        const definition = new RateLimitDefinition(1_000, 1);
        RateLimitProcessor.registerRateLimitStore(store);
        RateLimitProcessor.registerRateLimit(ExecutionTransport.Http, resolverOf('127.0.0.1'));

        await processor.process(definition, context());

        expect(store.consume).toHaveBeenCalledWith(JSON.stringify([ExecutionTransport.Http, '127.0.0.1', 'TestController', 'handle']), definition);
    });

    it('restores an in-memory store when the registered store is removed', () => {
        RateLimitProcessor.registerRateLimitStore({ consume: jest.fn() });
        RateLimitProcessor.registerRateLimitStore();

        expect((RateLimitProcessor as any).store).toBeInstanceOf(InMemoryRateLimitStore);
    });

    it('returns undefined when there is no rate limit definition', async () => {
        const resolver = resolverOf('127.0.0.1');
        RateLimitProcessor.registerRateLimit(ExecutionTransport.Http, resolver);

        await expect(processor.process(undefined, context())).resolves.toBeUndefined();
        expect(resolver.resolve).not.toHaveBeenCalled();
    });

    it('returns undefined when no resolver is registered for the transport', async () => {
        await expect(processor.process(new RateLimitDefinition(1_000, 3), context())).resolves.toBeUndefined();
    });

    it('keeps resolvers isolated by transport and supports unregistering', async () => {
        const definition = new RateLimitDefinition(1_000, 3);
        RateLimitProcessor.registerRateLimit(ExecutionTransport.Http, resolverOf('127.0.0.1'));

        await expect(processor.process(definition, context(ExecutionTransport.WebSocket))).resolves.toBeUndefined();
        RateLimitProcessor.registerRateLimit(ExecutionTransport.Http);
        await expect(processor.process(definition, context())).resolves.toBeUndefined();
    });
});
