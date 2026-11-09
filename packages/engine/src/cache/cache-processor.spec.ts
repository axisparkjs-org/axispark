import { CacheStore, InMemoryCacheStore } from '@axisparkjs/store';
import { Logger } from '@axisparkjs/logger';
import { ExecutionContext, ExecutionTransport } from '../execution';
import { ResultDefinition } from '../result';
import { CacheDefinition } from './cache-definition';
import { CacheProcessor } from './cache-processor';
import { CacheResolver } from './cache-resolver';

class FileResult extends ResultDefinition {
    async process(): Promise<void> {}
}

describe('CacheProcessor', () => {
    let processor: CacheProcessor;
    let logger: jest.Mocked<Logger>;
    let store: InMemoryCacheStore;
    let now: number;
    class ProductController {}
    class OrderController {}

    const context = (transport = ExecutionTransport.Http, target: object = ProductController, propertyKey = 'find') =>
        ({ transport, target, propertyKey }) as unknown as ExecutionContext;
    const resolverOf = (key?: string): jest.Mocked<CacheResolver> => ({ resolve: jest.fn().mockReturnValue(key) }) as jest.Mocked<CacheResolver>;
    const failingStore = (): jest.Mocked<CacheStore> => ({
        get: jest.fn().mockRejectedValue(new Error('Redis is down')),
        set: jest.fn().mockRejectedValue(new Error('Redis is down')),
        delete: jest.fn()
    });

    beforeEach(() => {
        now = 10_000;
        jest.spyOn(Date, 'now').mockImplementation(() => now);
        logger = { child: jest.fn().mockReturnThis(), debug: jest.fn(), warn: jest.fn() } as unknown as jest.Mocked<Logger>;
        processor = new CacheProcessor(logger);
        (CacheProcessor as any).resolvers.clear();
        (CacheProcessor as any).stores.clear();
        (CacheProcessor as any).lastWarnings.clear();
        store = new InMemoryCacheStore();
        CacheProcessor.registerCacheStore(ExecutionTransport.Http, store);
        CacheProcessor.registerCache(ExecutionTransport.Http, resolverOf('GET /products/1'));
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('uses a child logger', () => {
        expect(logger.child).toHaveBeenCalledWith('CacheProcessor');
    });

    it('invokes the handler once and returns the cached result while it is valid', async () => {
        const definition = new CacheDefinition(1_000);
        const invoke = jest.fn().mockResolvedValueOnce({ id: 1 }).mockResolvedValueOnce({ id: 2 });

        await expect(processor.process(definition, context(), invoke)).resolves.toEqual({ id: 1 });
        now += 999;
        await expect(processor.process(definition, context(), invoke)).resolves.toEqual({ id: 1 });
        expect(invoke).toHaveBeenCalledTimes(1);

        now += 1;
        await expect(processor.process(definition, context(), invoke)).resolves.toEqual({ id: 2 });
        expect(invoke).toHaveBeenCalledTimes(2);
    });

    it('caches falsy plain results such as null, 0 and false', async () => {
        for (const value of [null, 0, false, '']) {
            (CacheProcessor as any).stores.set(ExecutionTransport.Http, new InMemoryCacheStore());
            const invoke = jest.fn().mockResolvedValue(value);

            await processor.process(new CacheDefinition(1_000), context(), invoke);
            await expect(processor.process(new CacheDefinition(1_000), context(), invoke)).resolves.toBe(value);
            expect(invoke).toHaveBeenCalledTimes(1);
        }
    });

    it('stores the result with the ttl and the key of the transport, the handler, the generation and the request', async () => {
        const mockStore: jest.Mocked<CacheStore> = { get: jest.fn().mockResolvedValue(undefined), set: jest.fn(), delete: jest.fn() };
        CacheProcessor.registerCacheStore(ExecutionTransport.Http, mockStore);

        await processor.process(new CacheDefinition(30_000), context(), async () => 'value');

        expect(mockStore.get).toHaveBeenCalledWith('gen:ProductController.find');
        expect(mockStore.set).toHaveBeenCalledWith('http:ProductController.find:0:GET /products/1', { value: 'value' }, 30_000);
    });

    it('passes the context and the definition to the resolver', async () => {
        const resolver = resolverOf('key');
        const definition = new CacheDefinition(1_000);
        CacheProcessor.registerCache(ExecutionTransport.Http, resolver);

        await processor.process(definition, context(), async () => 'value');

        expect(resolver.resolve).toHaveBeenCalledWith(expect.objectContaining({ transport: ExecutionTransport.Http }), definition);
    });

    it('never shares the entries of two handlers or two transports', async () => {
        const definition = new CacheDefinition(1_000);
        CacheProcessor.registerCacheStore(ExecutionTransport.WebSocket, store);
        CacheProcessor.registerCache(ExecutionTransport.WebSocket, resolverOf('GET /products/1'));

        await processor.process(definition, context(), async () => 'products');
        await expect(processor.process(definition, context(ExecutionTransport.Http, OrderController), async () => 'orders')).resolves.toBe('orders');
        await expect(processor.process(definition, context(ExecutionTransport.Http, ProductController, 'list'), async () => 'list')).resolves.toBe('list');
        await expect(processor.process(definition, context(ExecutionTransport.WebSocket), async () => 'ws')).resolves.toBe('ws');
        await expect(processor.process(definition, context(), async () => 'other')).resolves.toBe('products');
    });

    it('invokes the handler without cache when there is no definition, resolver, store or key', async () => {
        const invoke = jest.fn().mockResolvedValue('value');

        await processor.process(undefined, context(), invoke);
        await processor.process(new CacheDefinition(1_000), context(ExecutionTransport.WebSocket), invoke);
        CacheProcessor.registerCacheStore(ExecutionTransport.WebSocket, store);
        await processor.process(new CacheDefinition(1_000), context(ExecutionTransport.WebSocket), invoke);
        CacheProcessor.registerCache(ExecutionTransport.Http, resolverOf(undefined));
        await processor.process(new CacheDefinition(1_000), context(), invoke);
        await processor.process(new CacheDefinition(1_000), context(), invoke);

        expect(invoke).toHaveBeenCalledTimes(5);
        expect(store.size).toBe(0);
    });

    it('unregisters the resolver and the store of a transport', async () => {
        const invoke = jest.fn().mockResolvedValue('value');
        CacheProcessor.registerCache(ExecutionTransport.Http);
        await processor.process(new CacheDefinition(1_000), context(), invoke);

        CacheProcessor.registerCache(ExecutionTransport.Http, resolverOf('key'));
        CacheProcessor.registerCacheStore(ExecutionTransport.Http);
        await processor.process(new CacheDefinition(1_000), context(), invoke);

        expect(invoke).toHaveBeenCalledTimes(2);
        expect(store.size).toBe(0);
    });

    it('does not cache undefined or ResultDefinition results, and logs why', async () => {
        const file = new FileResult(undefined, 200);
        const invoke = jest.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce(file).mockResolvedValueOnce(file);

        await expect(processor.process(new CacheDefinition(1_000), context(), invoke)).resolves.toBeUndefined();
        await expect(processor.process(new CacheDefinition(1_000), context(), invoke)).resolves.toBe(file);
        await expect(processor.process(new CacheDefinition(1_000), context(), invoke)).resolves.toBe(file);

        expect(invoke).toHaveBeenCalledTimes(3);
        expect(logger.debug).toHaveBeenCalledWith('The result of ProductController.find is not cached because it is undefined');
        expect(logger.debug).toHaveBeenCalledWith('The result of ProductController.find is not cached because it is a FileResult');
    });

    it('never caches the errors of the handler', async () => {
        const invoke = jest.fn().mockRejectedValueOnce(new Error('Not found')).mockResolvedValueOnce('value');

        await expect(processor.process(new CacheDefinition(1_000), context(), invoke)).rejects.toThrow('Not found');
        await expect(processor.process(new CacheDefinition(1_000), context(), invoke)).resolves.toBe('value');
    });

    it('invokes the handler when the store fails to read, and logs one warning a minute per transport', async () => {
        CacheProcessor.registerCacheStore(ExecutionTransport.Http, failingStore());
        const invoke = jest.fn().mockResolvedValue('value');

        await expect(processor.process(new CacheDefinition(1_000), context(), invoke)).resolves.toBe('value');
        await expect(processor.process(new CacheDefinition(1_000), context(), invoke)).resolves.toBe('value');
        expect(logger.warn).toHaveBeenCalledTimes(1);
        expect(logger.warn).toHaveBeenCalledWith('The http cache store failed, so the handlers run without cache: Redis is down');

        now += 60_000;
        await processor.process(new CacheDefinition(1_000), context(), invoke);
        expect(logger.warn).toHaveBeenCalledTimes(2);
        expect(invoke).toHaveBeenCalledTimes(3);
    });

    it('returns the result of the handler when the store fails to write', async () => {
        const mockStore = failingStore();
        mockStore.get.mockResolvedValue(undefined);
        CacheProcessor.registerCacheStore(ExecutionTransport.Http, mockStore);

        await expect(processor.process(new CacheDefinition(1_000), context(), async () => 'value')).resolves.toBe('value');
        expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    it('logs the stores that fail with a value that is not an error', async () => {
        CacheProcessor.registerCacheStore(ExecutionTransport.Http, { get: jest.fn().mockRejectedValue('timeout'), set: jest.fn(), delete: jest.fn() });

        await processor.process(new CacheDefinition(1_000), context(), async () => 'value');

        expect(logger.warn).toHaveBeenCalledWith('The http cache store failed, so the handlers run without cache: timeout');
    });

    describe('evict', () => {
        it('evicts every entry of a handler by incrementing its generation', async () => {
            const definition = new CacheDefinition(1_000);
            const invoke = jest.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second');
            await processor.process(definition, context(), invoke);

            await processor.evict(ProductController, 'find');

            await expect(processor.process(definition, context(), invoke)).resolves.toBe('second');
            await expect(processor.process(definition, context(), invoke)).resolves.toBe('second');
            expect(await store.get('gen:ProductController.find')).toBe(1);
            await processor.evict(ProductController, 'find');
            expect(await store.get('gen:ProductController.find')).toBe(2);
        });

        it('increments the generation once in a store shared by several transports', async () => {
            CacheProcessor.registerCacheStore(ExecutionTransport.WebSocket, store);
            const other = new InMemoryCacheStore();
            CacheProcessor.registerCacheStore(ExecutionTransport.Mcp, other);

            await processor.evict(ProductController, 'find');

            expect(await store.get('gen:ProductController.find')).toBe(1);
            expect(await other.get('gen:ProductController.find')).toBe(1);
        });

        it('does not evict the entries of other handlers', async () => {
            const invoke = jest.fn().mockResolvedValue('orders');
            await processor.process(new CacheDefinition(1_000), context(ExecutionTransport.Http, OrderController), invoke);

            await processor.evict(ProductController, 'find');
            await processor.process(new CacheDefinition(1_000), context(ExecutionTransport.Http, OrderController), invoke);

            expect(invoke).toHaveBeenCalledTimes(1);
        });

        it('evicts one entry of the current generation in every transport', async () => {
            const definition = new CacheDefinition(1_000);
            await processor.evict(ProductController, 'find');
            await processor.process(definition, context(), async () => 'one');
            CacheProcessor.registerCache(ExecutionTransport.Http, resolverOf('GET /products/2'));
            await processor.process(definition, context(), async () => 'two');
            const webSocketStore: jest.Mocked<CacheStore> = { get: jest.fn().mockResolvedValue(undefined), set: jest.fn(), delete: jest.fn() };
            CacheProcessor.registerCacheStore(ExecutionTransport.WebSocket, webSocketStore);

            await processor.evict(ProductController, 'find', 'GET /products/1');

            expect(await store.get('http:ProductController.find:1:GET /products/1')).toBeUndefined();
            expect(await store.get('http:ProductController.find:1:GET /products/2')).toEqual({ value: 'two' });
            expect(webSocketStore.delete).toHaveBeenCalledWith('websocket:ProductController.find:0:GET /products/1');
        });
    });
});
