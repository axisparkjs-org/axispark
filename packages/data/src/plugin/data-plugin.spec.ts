import { PluginNotConfiguredError } from '@axisparkjs/core';
import { DATA_LOGGER, DATA_OPTIONS } from '../di';
import { DataSourceConnectionManager } from '../connections';
import { RepositoryDefinition } from '../repository/repository-definition';
import { RepositoryGenerator } from '../repository/repository-generator';
import { DataPlugin } from './data-plugin';

describe('DataPlugin', () => {
    const childLogger = {
        info: jest.fn().mockResolvedValue(undefined)
    };
    const logger = {
        child: jest.fn().mockReturnValue(childLogger)
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('requires plugin options', async () => {
        const plugin = new DataPlugin(logger as any, {} as any);

        await expect(plugin.onRegister({ container: { bind: jest.fn() } } as any)).rejects.toBeInstanceOf(PluginNotConfiguredError);
    });

    it('binds options, logger, data sources, and generated repositories', async () => {
        const dataSource = { name: 'primary' };
        const repositoryTarget = class UserRepository {};
        const entityTarget = class UserEntity {};
        const implementation = {};
        const definition = new RepositoryDefinition(repositoryTarget, entityTarget as any, 'PRIMARY', implementation);
        const connectionManager = {
            createConnections: jest.fn().mockResolvedValue(undefined),
            getAllConnections: jest.fn(() => new Map([['primary', dataSource]])),
            destroyConnections: jest.fn().mockResolvedValue(undefined)
        };
        const repositoryGenerator = {
            generate: jest.fn().mockResolvedValue([definition])
        };
        const injector = {
            get: jest.fn(async (token: unknown) => (token === DataSourceConnectionManager ? connectionManager : repositoryGenerator))
        };
        const container = { bind: jest.fn() };
        const plugin = new DataPlugin(logger as any, injector as any);
        const options = { dataSources: [{ name: 'primary', options: { type: 'sqlite', database: ':memory:' } }] } as any;

        await plugin.onRegister({ container } as any, options);

        expect(logger.child).toHaveBeenCalledWith('DataPlugin');
        expect(injector.get).toHaveBeenNthCalledWith(1, DataSourceConnectionManager);
        expect(injector.get).toHaveBeenNthCalledWith(2, RepositoryGenerator);
        expect(connectionManager.createConnections).toHaveBeenCalledTimes(1);
        expect(repositoryGenerator.generate).toHaveBeenCalledTimes(1);
        expect(container.bind).toHaveBeenCalledWith({ token: DATA_OPTIONS, useValue: options });
        expect(container.bind).toHaveBeenCalledWith({ token: DATA_LOGGER, useValue: childLogger });
        expect(container.bind).toHaveBeenCalledWith({ token: expect.objectContaining({ description: 'DATA_SOURCE_PRIMARY' }), useValue: dataSource });
        expect(container.bind).toHaveBeenCalledWith({ token: repositoryTarget, useValue: implementation });
        expect(container.bind).toHaveBeenCalledWith({
            token: expect.objectContaining({ description: 'DATA_REPOSITORY_USERREPOSITORY' }),
            useValue: implementation
        });
        expect(childLogger.info).toHaveBeenCalledWith('Repositories registered: UserRepository');
        expect(childLogger.info).toHaveBeenCalledWith('Plugin registered');

        await plugin.onStart();
        await plugin.onStop();

        expect(connectionManager.destroyConnections).toHaveBeenCalledTimes(1);
        expect(childLogger.info).toHaveBeenCalledWith('Plugin started');
        expect(childLogger.info).toHaveBeenCalledWith('Plugin stopped');
    });

    it('registers successfully when there are no data sources or repositories', async () => {
        const connectionManager = {
            createConnections: jest.fn().mockResolvedValue(undefined),
            getAllConnections: jest.fn(() => new Map()),
            destroyConnections: jest.fn().mockResolvedValue(undefined)
        };
        const repositoryGenerator = { generate: jest.fn().mockResolvedValue([]) };
        const injector = {
            get: jest.fn(async (token: unknown) => (token === DataSourceConnectionManager ? connectionManager : repositoryGenerator))
        };
        const plugin = new DataPlugin(logger as any, injector as any);

        await plugin.onRegister({ container: { bind: jest.fn() } } as any, { dataSources: [] } as any);

        expect(childLogger.info).toHaveBeenCalledWith('Repositories registered: ');
        await plugin.onStop();
    });

    it('propagates connection initialization failures without generating repositories', async () => {
        const failure = new Error('database unavailable');
        const connectionManager = {
            createConnections: jest.fn().mockRejectedValue(failure),
            getAllConnections: jest.fn(),
            destroyConnections: jest.fn()
        };
        const repositoryGenerator = { generate: jest.fn() };
        const injector = {
            get: jest.fn(async (token: unknown) => (token === DataSourceConnectionManager ? connectionManager : repositoryGenerator))
        };
        const plugin = new DataPlugin(logger as any, injector as any);

        await expect(plugin.onRegister({ container: { bind: jest.fn() } } as any, { dataSources: [] } as any)).rejects.toBe(failure);
        expect(repositoryGenerator.generate).not.toHaveBeenCalled();
    });

    it('stops without throwing when registration did not complete', async () => {
        const rootLogger = { child: jest.fn().mockReturnValue(childLogger), info: jest.fn().mockResolvedValue(undefined) };
        const plugin = new DataPlugin(rootLogger as any, {} as any);

        await expect(plugin.onRegister({ container: { bind: jest.fn() } } as any)).rejects.toBeInstanceOf(PluginNotConfiguredError);

        await expect(plugin.onStop()).resolves.toBeUndefined();
        expect(rootLogger.info).toHaveBeenCalledWith('Plugin stopped');
    });
});
