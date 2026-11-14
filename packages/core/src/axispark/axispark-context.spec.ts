import { ConsoleTransport, Logger, LogLevel, SimpleFormatter } from '@axisparkjs/logger';
import { Container, Injector, ScopedContainerManager } from '@axisparkjs/di';
import { AxiSparkContext } from './axispark-context';
import { PluginRegistry } from '../plugin';
import { NullScanner } from '../scanner';
import { HealthEngine } from '../health';
import { AXISPARK_CONFIG } from './axispark-config';
import { AXISPARK_ENV_SETTINGS, InvalidSettingsError } from '../settings';

describe('AxiSparkContext', () => {
    describe('constructor', () => {
        let context: AxiSparkContext;

        beforeEach(() => {
            context = new AxiSparkContext();
        });

        it('should create a logger', () => {
            expect(context.logger).toBeInstanceOf(Logger);
        });

        it('should create a plugin registry', () => {
            expect(context.plugins).toBeInstanceOf(PluginRegistry);
        });

        it('should create a DI container', () => {
            expect(context.container).toBeInstanceOf(Container);
        });

        it('should create an injector', () => {
            expect(context.container.resolve(Injector)).resolves.toBeInstanceOf(Injector);
        });

        it('should create a scanner', () => {
            expect(context.scanner).toBeDefined();
        });

        it('should create the default private configuration', () => {
            expect(context.privateConfig).toEqual({
                scanner: 'file-system',
                wait: true
            });
        });

        it('should create the default configuration', () => {
            expect(context.config).toMatchObject({
                name: 'App',
                environment: 'development',
                banner: true
            });

            expect(context.config.logTransports).toHaveLength(1);
            expect(context.config.logTransports?.[0]).toBeInstanceOf(ConsoleTransport);
        });

        it('should register configuration in the container', async () => {
            expect(await context.container.resolve(AXISPARK_CONFIG)).toBe(context.config);
        });

        it('should register Logger in the container', async () => {
            expect(await context.container.resolve(Logger)).toBe(context.logger);
        });

        it('should register Injector in the container', async () => {
            const injector = await context.container.resolve(Injector);

            expect(injector).toBeInstanceOf(Injector);
        });

        it('should register ScopedContainerManager in the container', async () => {
            const manager = await context.container.resolve(ScopedContainerManager);

            expect(manager).toBeInstanceOf(ScopedContainerManager);
        });

        it('should register HealthEngine in the container', async () => {
            const healthEngine = await context.container.resolve(HealthEngine);

            expect(healthEngine).toBeInstanceOf(HealthEngine);
        });

        it('should override default configuration', async () => {
            const transport = new ConsoleTransport({
                formatter: new SimpleFormatter(),
                minLevel: LogLevel.Error
            });

            const context = new AxiSparkContext(
                {
                    name: 'MyApp',
                    environment: 'production',
                    banner: false,
                    logTransports: [transport]
                },
                {
                    wait: true,
                    scanner: 'null'
                }
            );

            expect(context.config).toEqual({
                name: 'MyApp',
                environment: 'production',
                banner: false,
                logTransports: [transport]
            });

            expect(context.privateConfig).toEqual({
                wait: true,
                scanner: 'null'
            });

            expect(context.logger).toBeInstanceOf(Logger);
            expect(context.plugins).toBeInstanceOf(PluginRegistry);
            expect(context.container).toBeInstanceOf(Container);
            expect(context.scanner).toBeInstanceOf(NullScanner);

            expect(await context.container.resolve(AXISPARK_CONFIG)).toBe(context.config);

            expect(await context.container.resolve(Logger)).toBe(context.logger);

            expect(await context.container.resolve(Injector)).toBeInstanceOf(Injector);

            expect(await context.container.resolve(ScopedContainerManager)).toBeInstanceOf(ScopedContainerManager);

            expect(await context.container.resolve(HealthEngine)).toBeInstanceOf(HealthEngine);
        });
    });

    describe('settings', () => {
        afterEach(() => {
            delete process.env.AXISPARK_CONTEXT_PORT;
        });

        it('should bind an empty frozen object without the settings option', async () => {
            const context = new AxiSparkContext({}, { scanner: 'null' });

            expect(context.settings).toEqual({});
            expect(Object.isFrozen(context.settings)).toBe(true);
            expect(await context.container.resolve(AXISPARK_ENV_SETTINGS)).toBe(context.settings);
        });

        it('should load the settings from the environment and bind them', async () => {
            process.env.AXISPARK_CONTEXT_PORT = '4321';
            const context = new AxiSparkContext({ settings: { load: (env) => ({ port: env.int('AXISPARK_CONTEXT_PORT', 3000) }) } }, { scanner: 'null' });

            expect(context.settings).toEqual({ port: 4321 });
            expect(Object.isFrozen(context.settings)).toBe(true);
            expect(await context.container.resolve(AXISPARK_ENV_SETTINGS)).toBe(context.settings);
        });

        it('should throw an InvalidSettingsError when the settings are not valid', () => {
            process.env.AXISPARK_CONTEXT_PORT = 'abc';

            expect(() => new AxiSparkContext({ settings: { load: (env) => ({ port: env.int('AXISPARK_CONTEXT_PORT') }) } }, { scanner: 'null' })).toThrow(
                InvalidSettingsError
            );
        });

        it('should use the settings of the private configuration without reading the environment', () => {
            const load = jest.fn();
            const context = new AxiSparkContext({ settings: { load } }, { scanner: 'null', settings: { port: 1 } });

            expect(load).not.toHaveBeenCalled();
            expect(context.settings).toEqual({ port: 1 });
            expect(Object.isFrozen(context.settings)).toBe(true);
        });
    });
});
