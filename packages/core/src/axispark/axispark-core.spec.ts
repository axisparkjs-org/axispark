import { AxiSparkCore } from './axispark-core';
import { AxiSparkContext } from './axispark-context';
import { InjectionToken } from '@axisparkjs/di';

describe('AxiSparkCore', () => {
    let context: jest.Mocked<AxiSparkContext>;
    let core: AxiSparkCore;

    beforeEach(() => {
        context = {
            logger: {
                info: jest.fn().mockResolvedValue(undefined)
            },
            plugins: {
                init: jest.fn(),
                run: jest.fn(),
                destroy: jest.fn(),
                register: jest.fn(),
                getAll: jest.fn()
            },
            container: {
                init: jest.fn(),
                resolve: jest.fn()
            },
            config: {
                banner: true
            },
            privateConfig: {
                wait: true
            },
            scanner: {
                scan: jest.fn()
            },
            settings: Object.freeze({ port: 3000 })
        } as unknown as jest.Mocked<AxiSparkContext>;

        core = new AxiSparkCore(context);
    });

    describe('config', () => {
        it('should return the context config', () => {
            const config = core.config;

            expect(config).toBe(context.config);
        });
    });

    describe('settings', () => {
        it('should return the context settings', () => {
            expect(core.settings).toBe(context.settings);
        });
    });

    describe('init', () => {
        it('should init the application and log the initialization', async () => {
            await core.init();

            expect(context.scanner.scan).toHaveBeenCalled();
            expect(context.container.init).toHaveBeenCalled();
            expect(context.plugins.init).toHaveBeenCalledWith(context);
            expect(context.logger.info).toHaveBeenCalledWith('App initialized');
        });

        it('should init the application and not log the banner', async () => {
            context.config.banner = false;
            await core.init();

            expect(context.scanner.scan).toHaveBeenCalled();
            expect(context.container.init).toHaveBeenCalled();
            expect(context.plugins.init).toHaveBeenCalledWith(context);
            expect(context.logger.info).not.toHaveBeenCalledWith(`
    ╔═════════════════════════════════════════════╗
    ║                                             ║
    ║                 AxiSpark.js                 ║
    ║                                             ║
    ║      Fast • Modular • TypeScript First      ║
    ║                                             ║
    ╚═════════════════════════════════════════════╝
            `);
            expect(context.logger.info).toHaveBeenCalledWith('App initialized');
        });
    });

    describe('run', () => {
        it('should run the application and log that it is running', async () => {
            core.run();

            await new Promise(process.nextTick);

            expect(context.plugins.run).toHaveBeenCalledWith(context);
            expect(context.logger.info).toHaveBeenCalledWith('App running, waiting for termination signal...');
            await core.destroy();
        });

        it('should not await termination signal if wait is false', async () => {
            context.privateConfig.wait = false;

            await core.run();

            expect(context.plugins.run).toHaveBeenCalledWith(context);
            expect(context.logger.info).toHaveBeenCalledWith('App running, waiting for termination signal...');
            await core.destroy();
        });

        it('should await termination signal if wait is true', async () => {
            context.privateConfig.wait = true;

            const runPromise = core.run();

            await new Promise(process.nextTick);

            expect(context.plugins.run).toHaveBeenCalledWith(context);
            expect(context.logger.info).toHaveBeenCalledWith('App running, waiting for termination signal...');

            // Simulate termination signal
            process.emit('SIGINT');

            await runPromise;

            await core.destroy();
        });

        it('should handle termination signal and destroy the application', async () => {
            context.privateConfig.wait = true;

            const runPromise = core.run();

            await new Promise(process.nextTick);

            expect(context.plugins.run).toHaveBeenCalledWith(context);
            expect(context.logger.info).toHaveBeenCalledWith('App running, waiting for termination signal...');

            // Simulate termination signal
            process.emit('SIGTERM');

            await runPromise;

            await core.destroy();
        });
    });

    describe('destroy', () => {
        it('should log that the application has been destroyed', async () => {
            await core.destroy();

            expect(context.plugins.destroy).toHaveBeenCalledWith(context);
            expect(context.logger.info).toHaveBeenCalledWith('App destroyed');
        });
    });

    describe('use', () => {
        it('should register a plugin and return the axisparkCore instance', () => {
            const plugin = jest.fn();
            const config = { plugin };
            const result = core.use(plugin, config);

            expect(context.plugins.register).toHaveBeenCalledWith(plugin, config);
            expect(result).toBe(core);
        });
    });

    describe('used', () => {
        it('should return the list of registered plugins', () => {
            const plugin1 = jest.fn();
            const plugin2 = jest.fn();
            const config1 = { plugin: plugin1 };
            context.plugins.getAll = jest.fn().mockReturnValue([
                { type: plugin1, options: config1 },
                { type: plugin2, options: undefined }
            ]);

            core.use(plugin1, config1);
            core.use(plugin2);

            const usedPlugins = core.used();

            expect(context.plugins.getAll).toHaveBeenCalled();
            expect(usedPlugins).toEqual([
                { type: plugin1, options: config1 },
                { type: plugin2, options: undefined }
            ]);
        });
    });

    describe('get', () => {
        it('should resolve a dependency from the container', async () => {
            const token = new InjectionToken('TestToken');
            const instance = { foo: 'bar' };
            context.container.resolve = jest.fn().mockReturnValue(instance);

            const result = await core.get(token);

            expect(context.container.resolve).toHaveBeenCalledWith(token);
            expect(result).toBe(instance);
        });
    });
});
