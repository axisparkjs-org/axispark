import { AxiSparkContext, HealthEngine, PluginNotConfiguredError } from '@axisparkjs/core';
import { Logger } from '@axisparkjs/logger';
import { Injector } from '@axisparkjs/di';
import { RedisConnectionManager } from '../connections';
import { REDIS_LOGGER, REDIS_OPTIONS, redisConnectionToken } from '../di';
import { RedisPlugin } from './redis-plugin';
import { RedisPluginOptions } from './redis-plugin-options';
import { RedisHealthIndicator } from '../health';

describe('RedisPlugin', () => {
    let plugin: RedisPlugin;
    let logger: { child: jest.Mock; info: jest.Mock; error: jest.Mock };
    let connectionManager: { createConnections: jest.Mock; destroyConnections: jest.Mock; getAllConnections: jest.Mock };
    let injector: { get: jest.Mock };
    let healthEngine: { register: jest.Mock };
    let context: { container: { bind: jest.Mock } };

    const options = (connections: any[] = []): RedisPluginOptions => ({ connections, plugin: RedisPlugin }) as RedisPluginOptions;
    const appContext = () => context as unknown as AxiSparkContext;

    beforeEach(() => {
        jest.clearAllMocks();
        logger = {
            child: jest.fn(),
            info: jest.fn().mockResolvedValue(undefined),
            error: jest.fn().mockResolvedValue(undefined)
        };
        logger.child.mockReturnValue(logger);
        connectionManager = {
            createConnections: jest.fn().mockResolvedValue(undefined),
            destroyConnections: jest.fn().mockResolvedValue(undefined),
            getAllConnections: jest.fn().mockReturnValue(new Map())
        };
        injector = {
            get: jest.fn().mockImplementation((token) => Promise.resolve(token === RedisConnectionManager ? connectionManager : healthEngine))
        };
        healthEngine = { register: jest.fn() };
        context = { container: { bind: jest.fn() } };
        plugin = new RedisPlugin(logger as unknown as Logger, injector as unknown as Injector);
    });

    it('rejects registration without plugin options', async () => {
        await expect(plugin.onRegister(appContext())).rejects.toBeInstanceOf(PluginNotConfiguredError);
        expect(injector.get).not.toHaveBeenCalled();
    });

    it('binds options and logger, creates connections, and binds each connection by its namespaced token', async () => {
        const primary = {};
        const reports = {};
        connectionManager.getAllConnections.mockReturnValue(
            new Map([
                ['PRIMARY', primary],
                ['REPORTS', reports]
            ])
        );
        const configuredOptions = options([
            { name: 'PRIMARY', url: 'redis://primary' },
            { name: 'REPORTS', url: 'redis://reports' }
        ]);

        await plugin.onRegister(appContext(), configuredOptions);

        expect(logger.child).toHaveBeenCalledWith('RedisPlugin');
        expect(context.container.bind).toHaveBeenCalledWith({ token: REDIS_OPTIONS, useValue: configuredOptions });
        expect(context.container.bind).toHaveBeenCalledWith({ token: REDIS_LOGGER, useValue: logger });
        expect(injector.get).toHaveBeenCalledWith(RedisConnectionManager);
        expect(connectionManager.createConnections).toHaveBeenCalledTimes(1);
        expect(context.container.bind).toHaveBeenCalledWith({
            token: redisConnectionToken('PRIMARY'),
            useValue: primary
        });
        expect(context.container.bind).toHaveBeenCalledWith({
            token: redisConnectionToken('REPORTS'),
            useValue: reports
        });
        expect(injector.get).toHaveBeenCalledWith(HealthEngine);
        expect(healthEngine.register).toHaveBeenCalledWith(expect.any(RedisHealthIndicator), { name: 'redis:PRIMARY' });
        expect(healthEngine.register).toHaveBeenCalledWith(expect.any(RedisHealthIndicator), { name: 'redis:REPORTS' });
        expect(logger.info).toHaveBeenCalledWith('Plugin registered');
    });

    it('does not register health checks when they are disabled', async () => {
        connectionManager.getAllConnections.mockReturnValue(new Map([['PRIMARY', {}]]));

        await plugin.onRegister(appContext(), { ...options([{ name: 'PRIMARY', url: 'redis://primary' }]), healthChecks: false });

        expect(injector.get).not.toHaveBeenCalledWith(HealthEngine);
        expect(healthEngine.register).not.toHaveBeenCalled();
    });

    it('propagates connection startup failures without logging successful registration', async () => {
        const failure = new Error('connection manager failed');
        connectionManager.createConnections.mockRejectedValue(failure);

        await expect(plugin.onRegister(appContext(), options([{ name: 'PRIMARY', url: 'redis://primary' }]))).rejects.toBe(failure);

        expect(connectionManager.getAllConnections).not.toHaveBeenCalled();
        expect(logger.info).not.toHaveBeenCalledWith('Plugin registered');
    });

    it('logs startup and closes all connections during shutdown', async () => {
        await plugin.onRegister(appContext(), options());

        await plugin.onStart();
        await plugin.onStop();

        expect(logger.info).toHaveBeenCalledWith('Plugin started');
        expect(connectionManager.destroyConnections).toHaveBeenCalledTimes(1);
        expect(logger.info).toHaveBeenCalledWith('Plugin stopped');
    });

    it('stops without throwing when registration did not complete', async () => {
        await expect(plugin.onRegister(appContext())).rejects.toBeInstanceOf(PluginNotConfiguredError);

        await expect(plugin.onStop()).resolves.toBeUndefined();

        expect(connectionManager.destroyConnections).not.toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledWith('Plugin stopped');
    });
});
