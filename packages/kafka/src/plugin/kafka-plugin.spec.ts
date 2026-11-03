import { AxiSparkContext, HealthEngine, PluginNotConfiguredError } from '@axisparkjs/core';
import { Logger } from '@axisparkjs/logger';
import { InjectableScopes, Injector, InjectionToken } from '@axisparkjs/di';
import { KafkaConnectionManager } from '../connections';
import { KAFKA_LOGGER, KAFKA_OPTIONS } from '../di';
import { KafkaPlugin } from './kafka-plugin';
import { KafkaPluginOptions } from './kafka-plugin-options';
import { KafkaHealthIndicator } from '../health';

describe('KafkaPlugin', () => {
    let plugin: KafkaPlugin;
    let logger: { child: jest.Mock; info: jest.Mock };
    let connectionManager: {
        createConnections: jest.Mock;
        destroyConnections: jest.Mock;
        getAllConnections: jest.Mock;
        getProducer: jest.Mock;
        getConsumer: jest.Mock;
        createProducer: jest.Mock;
        createConsumer: jest.Mock;
    };
    let injector: { get: jest.Mock };
    let healthEngine: { register: jest.Mock };
    let context: { container: { bind: jest.Mock } };

    const options = (connections: any[] = []): KafkaPluginOptions =>
        ({
            connections,
            plugin: KafkaPlugin
        }) as KafkaPluginOptions;
    const appContext = () => context as unknown as AxiSparkContext;

    beforeEach(() => {
        jest.clearAllMocks();
        logger = { child: jest.fn(), info: jest.fn().mockResolvedValue(undefined) };
        logger.child.mockReturnValue(logger);
        connectionManager = {
            createConnections: jest.fn().mockResolvedValue(undefined),
            destroyConnections: jest.fn().mockResolvedValue(undefined),
            getAllConnections: jest.fn().mockReturnValue(new Map()),
            getProducer: jest.fn(),
            getConsumer: jest.fn(),
            createProducer: jest.fn().mockResolvedValue(undefined),
            createConsumer: jest.fn().mockResolvedValue(undefined)
        };
        injector = {
            get: jest.fn().mockImplementation((token) => Promise.resolve(token === KafkaConnectionManager ? connectionManager : healthEngine))
        };
        healthEngine = { register: jest.fn() };
        context = { container: { bind: jest.fn() } };
        plugin = new KafkaPlugin(logger as unknown as Logger, injector as unknown as Injector);
    });

    it('rejects registration without plugin options', async () => {
        await expect(plugin.onRegister(appContext())).rejects.toBeInstanceOf(PluginNotConfiguredError);
        expect(injector.get).not.toHaveBeenCalled();
    });

    it('binds plugin dependencies, Kafka connections, and initialized clients', async () => {
        const primary = {};
        const reports = {};
        const primaryProducer = {};
        const primaryConsumer = {};
        connectionManager.getAllConnections.mockReturnValue(
            new Map([
                ['PRIMARY', primary],
                ['REPORTS', reports]
            ])
        );
        connectionManager.getProducer.mockImplementation((name) => (name === 'PRIMARY' ? primaryProducer : undefined));
        connectionManager.getConsumer.mockImplementation((name) => (name === 'PRIMARY' ? primaryConsumer : undefined));
        const configuredOptions = options([
            { name: 'PRIMARY', config: { brokers: ['localhost:9092'] } },
            { name: 'REPORTS', config: { brokers: ['localhost:9093'] }, autoInitialize: false }
        ]);

        await plugin.onRegister(appContext(), configuredOptions);

        expect(logger.child).toHaveBeenCalledWith('KafkaPlugin');
        expect(context.container.bind).toHaveBeenCalledWith({ token: KAFKA_OPTIONS, useValue: configuredOptions });
        expect(context.container.bind).toHaveBeenCalledWith({ token: KAFKA_LOGGER, useValue: logger });
        expect(injector.get).toHaveBeenCalledWith(KafkaConnectionManager);
        expect(connectionManager.createConnections).toHaveBeenCalledTimes(1);
        expect(context.container.bind).toHaveBeenCalledWith({
            token: new InjectionToken('KAFKA_CONNECTION_PRIMARY'),
            useValue: primary
        });
        expect(context.container.bind).toHaveBeenCalledWith({
            token: new InjectionToken('KAFKA_CONNECTION_REPORTS'),
            useValue: reports
        });
        expect(context.container.bind).toHaveBeenCalledWith({
            token: new InjectionToken('KAFKA_PRODUCER_PRIMARY'),
            useValue: primaryProducer
        });
        expect(context.container.bind).toHaveBeenCalledWith({
            token: new InjectionToken('KAFKA_CONSUMER_PRIMARY'),
            useValue: primaryConsumer
        });
        expect(injector.get).toHaveBeenCalledWith(HealthEngine);
        expect(healthEngine.register).toHaveBeenCalledWith(expect.any(KafkaHealthIndicator), { name: 'kafka:PRIMARY' });
        expect(healthEngine.register).toHaveBeenCalledWith(expect.any(KafkaHealthIndicator), { name: 'kafka:REPORTS' });
        expect(logger.info).toHaveBeenCalledWith('Plugin registered');
    });

    it('does not register health checks when they are disabled', async () => {
        connectionManager.getAllConnections.mockReturnValue(new Map([['PRIMARY', {}]]));

        await plugin.onRegister(appContext(), { ...options([{ name: 'PRIMARY', config: { brokers: ['localhost:9092'] } }]), healthChecks: false });

        expect(injector.get).not.toHaveBeenCalledWith(HealthEngine);
        expect(healthEngine.register).not.toHaveBeenCalled();
    });

    it('binds singleton factories for clients configured for lazy initialization', async () => {
        const kafka = {};
        connectionManager.getAllConnections.mockReturnValue(new Map([['MANUAL', kafka]]));

        await plugin.onRegister(appContext(), options([{ name: 'MANUAL', config: { brokers: ['localhost:9092'] }, autoInitialize: false }]));

        const producerBinding = context.container.bind.mock.calls
            .map(([binding]) => binding)
            .find(({ token }) => token.description === 'KAFKA_PRODUCER_MANUAL');
        const consumerBinding = context.container.bind.mock.calls
            .map(([binding]) => binding)
            .find(({ token }) => token.description === 'KAFKA_CONSUMER_MANUAL');

        expect(producerBinding).toEqual(expect.objectContaining({ forClass: Object, scope: InjectableScopes.Singleton }));
        expect(consumerBinding).toEqual(expect.objectContaining({ forClass: Object, scope: InjectableScopes.Singleton }));
        await expect(producerBinding.useFactory()).resolves.toBeUndefined();
        await expect(consumerBinding.useFactory()).resolves.toBeUndefined();
        expect(connectionManager.createProducer).toHaveBeenCalledWith('MANUAL');
        expect(connectionManager.createConsumer).toHaveBeenCalledWith('MANUAL');
    });

    it('propagates connection startup failures without logging successful registration', async () => {
        const failure = new Error('connection manager failed');
        connectionManager.createConnections.mockRejectedValue(failure);

        await expect(plugin.onRegister(appContext(), options([{ name: 'PRIMARY', config: { brokers: ['localhost:9092'] } }]))).rejects.toBe(failure);

        expect(connectionManager.getAllConnections).not.toHaveBeenCalled();
        expect(logger.info).not.toHaveBeenCalledWith('Plugin registered');
    });

    it('logs startup and disconnects Kafka clients during shutdown', async () => {
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
