import { ExecutionContext, ExecutionTransport } from '../execution';
import { RateLimitDefinition } from './rate-limit-definition';
import { RateLimitProcessor } from './rate-limit-processor';
import { RateLimitResolver } from './rate-limit-resolver';
import { InMemoryRateLimitStore, RateLimitStore } from '@axisparkjs/store';

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
        (RateLimitProcessor as any).stores.clear();
        const store = new InMemoryRateLimitStore();
        RateLimitProcessor.registerRateLimitStore(ExecutionTransport.Http, store);
        RateLimitProcessor.registerRateLimitStore(ExecutionTransport.WebSocket, store);
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
        RateLimitProcessor.registerRateLimitStore(ExecutionTransport.Http, store);
        RateLimitProcessor.registerRateLimit(ExecutionTransport.Http, resolverOf('127.0.0.1'));

        await processor.process(definition, context());

        expect(store.consume).toHaveBeenCalledWith(JSON.stringify([ExecutionTransport.Http, '127.0.0.1', 'TestController', 'handle']), definition);
    });

    it('returns undefined when no store is registered for the transport', async () => {
        const resolver = resolverOf('127.0.0.1');
        RateLimitProcessor.registerRateLimit(ExecutionTransport.Http, resolver);
        RateLimitProcessor.registerRateLimitStore(ExecutionTransport.Http);

        await expect(processor.process(new RateLimitDefinition(1_000, 3), context())).resolves.toBeUndefined();
        expect(resolver.resolve).not.toHaveBeenCalled();
    });

    it('uses the store registered for the transport of the context', async () => {
        const httpStore: RateLimitStore = { consume: jest.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }) };
        const webSocketStore: RateLimitStore = { consume: jest.fn().mockResolvedValue({ allowed: false, retryAfterMs: 100 }) };
        const definition = new RateLimitDefinition(1_000, 1);
        RateLimitProcessor.registerRateLimit(ExecutionTransport.Http, resolverOf('client'));
        RateLimitProcessor.registerRateLimit(ExecutionTransport.WebSocket, resolverOf('client'));
        RateLimitProcessor.registerRateLimitStore(ExecutionTransport.Http, httpStore);
        RateLimitProcessor.registerRateLimitStore(ExecutionTransport.WebSocket, webSocketStore);

        await expect(processor.process(definition, context())).resolves.toEqual({ allowed: true, retryAfterMs: 0 });
        await expect(processor.process(definition, context(ExecutionTransport.WebSocket))).resolves.toEqual({ allowed: false, retryAfterMs: 100 });
        expect(httpStore.consume).toHaveBeenCalledTimes(1);
        expect(webSocketStore.consume).toHaveBeenCalledTimes(1);
    });

    it('keeps the store of a transport when another transport registers its own', async () => {
        const httpStore: RateLimitStore = { consume: jest.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }) };
        RateLimitProcessor.registerRateLimit(ExecutionTransport.Http, resolverOf('client'));
        RateLimitProcessor.registerRateLimitStore(ExecutionTransport.Http, httpStore);
        RateLimitProcessor.registerRateLimitStore(ExecutionTransport.WebSocket, new InMemoryRateLimitStore());

        await processor.process(new RateLimitDefinition(1_000, 1), context());

        expect(httpStore.consume).toHaveBeenCalledTimes(1);
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

describe('RateLimitProcessor instrumentation', () => {
    afterEach(() => {
        RateLimitProcessor.registerInstrumentation();
        (RateLimitProcessor as any).resolvers.clear();
        (RateLimitProcessor as any).stores.clear();
    });

    it('reports every decision to the registered instrumentation', async () => {
        const decided = jest.fn();
        const definition = new RateLimitDefinition(1_000, 0);
        const context = { transport: ExecutionTransport.Http, target: class Controller {}, propertyKey: 'handle' } as unknown as ExecutionContext;
        RateLimitProcessor.registerInstrumentation({ decided });
        RateLimitProcessor.registerRateLimit(ExecutionTransport.Http, { resolve: () => 'client' });
        RateLimitProcessor.registerRateLimitStore(ExecutionTransport.Http, new InMemoryRateLimitStore());

        const decision = await new RateLimitProcessor().process(definition, context);

        expect(decided).toHaveBeenCalledWith(context, definition, decision);
        expect(decision?.allowed).toBe(false);
    });
});
