import { AxiSparkContext, HealthEngine, Plugin } from '@axisparkjs/core';
import { Logger } from '@axisparkjs/logger';
import { RabbitMQPluginOptions } from './rabbitmq-plugin-options';
import { RABBITMQ_LOGGER, RABBITMQ_OPTIONS } from '../di';
import { PluginNotConfiguredError } from '@axisparkjs/core';
import { Injectable, InjectionToken, Injector } from '@axisparkjs/di';
import { RabbitMQConnectionManager } from '../connections';
import { RabbitMQHealthIndicator } from '../health';

/**
 * A plugin for integrating RabbitMQ into the application.
 */
@Injectable()
export class RabbitMQPlugin extends Plugin {
    private context: AxiSparkContext;
    protected options: RabbitMQPluginOptions;
    private connectionManager: RabbitMQConnectionManager;

    constructor(
        private logger: Logger,
        private readonly injector: Injector
    ) {
        super();
    }

    async onRegister(context: AxiSparkContext, options?: RabbitMQPluginOptions): Promise<void> {
        if (!options) throw new PluginNotConfiguredError(RabbitMQPlugin.name);
        this.context = context;
        this.options = options;
        this.logger = this.logger.child('RabbitMQPlugin');

        this.registerContainerBindings();
        await this.startConnectionManager();
        await this.registerHealthChecks();

        await this.logger.info(`Plugin registered`);
    }

    private async startConnectionManager(): Promise<void> {
        this.connectionManager = await this.injector.get<RabbitMQConnectionManager>(RabbitMQConnectionManager);
        await this.connectionManager.createConnections();
        const connections = this.connectionManager.getAllConnections();

        for (const [name, connection] of connections.entries()) {
            this.context.container.bind({ token: new InjectionToken(`RABBITMQ_CONNECTION_${name}`), useValue: connection });
        }
    }

    private async registerHealthChecks(): Promise<void> {
        if (this.options.healthChecks === false) return;

        const healthEngine = await this.injector.get(HealthEngine);
        for (const [name, connection] of this.connectionManager.getAllConnections().entries()) {
            healthEngine.register(new RabbitMQHealthIndicator(connection), { name: `rabbitmq:${name}` });
        }
    }

    private registerContainerBindings(): void {
        this.context.container.bind({ token: RABBITMQ_OPTIONS, useValue: this.options });
        this.context.container.bind({ token: RABBITMQ_LOGGER, useValue: this.logger });
    }

    async onStart(): Promise<void> {
        await this.logger.info(`Plugin started`);
    }

    async onStop(): Promise<void> {
        await this.connectionManager?.destroyConnections();
        await this.logger.info(`Plugin stopped`);
    }
}
