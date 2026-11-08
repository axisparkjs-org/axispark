import { ExecutionTransport, TimeoutGenerator, TimeoutProcessor } from '@axisparkjs/engine';
import { WebSocketPlugin } from './websocket-plugin';

describe('WebSocketPlugin', () => {
    const baseOptions: any = { adapter: class {}, useHttpPluginServer: false, port: 42 };
    let httpTrustProxy: unknown;
    beforeEach(() => (httpTrustProxy = undefined));
    const createPlugin = (useHttpPluginServer = false) => {
        const adapter = { initialize: jest.fn(), registerEvents: jest.fn(), start: jest.fn(), stop: jest.fn() };
        const container: any = { bind: jest.fn(), resolve: jest.fn().mockResolvedValue(adapter) };
        const logger = { child: jest.fn().mockReturnThis(), info: jest.fn() };
        const injector = {
            get: jest.fn(async (token: any) => {
                if (String(token).includes('HTTP_OPTIONS')) return { port: 80, trustProxy: httpTrustProxy };
                if (String(token).includes('HTTP_ADAPTER')) return { getHttpServer: () => 'server' };
                if (token.name === 'WebSocketEventGenerator') return { generate: async () => ['event'] };
                return {};
            })
        };
        const plugin = new WebSocketPlugin(logger as any, injector as any);
        return { plugin, adapter, container, logger, injector, context: { container }, options: { ...baseOptions, useHttpPluginServer } };
    };
    it('requires options', async () => {
        await expect(createPlugin().plugin.onRegister({} as any)).rejects.toThrow();
    });
    it('registers bindings and implementations, then starts and stops the adapter', async () => {
        const test = createPlugin();
        await test.plugin.onRegister(test.context as any, test.options);
        expect(test.container.bind).toHaveBeenCalledTimes(3);
        expect(test.adapter.initialize).toHaveBeenCalledWith(undefined);
        expect(test.adapter.registerEvents).toHaveBeenCalledWith(['event']);
        await test.plugin.onStart();
        await test.plugin.onStop();
        expect(test.adapter.start).toHaveBeenCalled();
        expect(test.adapter.stop).toHaveBeenCalled();
    });
    it('uses the configured HTTP server when requested', async () => {
        const test = createPlugin(true);
        await test.plugin.onRegister(test.context as any, test.options);
        expect(test.adapter.initialize).toHaveBeenCalledWith('server');
        await test.plugin.onStart();
    });
    it('uses the trustProxy option of the HTTP plugin when using its server and no trustProxy is configured', async () => {
        httpTrustProxy = 'loopback';
        const test = createPlugin(true);
        await test.plugin.onRegister(test.context as any, test.options);
        expect(test.container.bind).toHaveBeenCalledWith({ token: expect.anything(), useValue: expect.objectContaining({ trustProxy: 'loopback' }) });
    });
    it('keeps its own trustProxy option when using the HTTP plugin server', async () => {
        httpTrustProxy = 'loopback';
        const test = createPlugin(true);
        await test.plugin.onRegister(test.context as any, { ...test.options, trustProxy: false });
        expect(test.container.bind).toHaveBeenCalledWith({ token: expect.anything(), useValue: expect.objectContaining({ trustProxy: false }) });
    });
    it('supports adapters without an initialize method', async () => {
        const test = createPlugin();
        test.context.container.resolve = jest.fn().mockResolvedValue({ registerEvents: jest.fn(), start: jest.fn(), stop: jest.fn() });
        await test.plugin.onRegister(test.context as any, test.options);
    });
    describe('timeouts', () => {
        afterEach(() => jest.restoreAllMocks());

        it('registers the timeout resolver without a default timeout when timeout is disabled', async () => {
            const generatorSpy = jest.spyOn(TimeoutGenerator, 'registerTimeout');
            const processorSpy = jest.spyOn(TimeoutProcessor, 'registerTimeout');
            const test = createPlugin();
            await test.plugin.onRegister(test.context as any, test.options);
            expect(generatorSpy).not.toHaveBeenCalledWith(ExecutionTransport.WebSocket, expect.anything());
            expect(processorSpy).toHaveBeenCalledWith(ExecutionTransport.WebSocket, expect.anything());
        });

        it('registers the default timeout and the timeout resolver when timeout is enabled', async () => {
            const generatorSpy = jest.spyOn(TimeoutGenerator, 'registerTimeout');
            const processorSpy = jest.spyOn(TimeoutProcessor, 'registerTimeout');
            const test = createPlugin();
            await test.plugin.onRegister(test.context as any, { ...test.options, timeout: true, timeoutOptions: { time: 250 } });
            expect(generatorSpy).toHaveBeenCalledWith(ExecutionTransport.WebSocket, 250);
            expect(processorSpy).toHaveBeenCalledWith(ExecutionTransport.WebSocket, expect.anything());
        });
    });
});
