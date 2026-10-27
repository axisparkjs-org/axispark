import { AxiSparkContext, Plugin } from '@axisparkjs/core';
import { Logger } from '@axisparkjs/logger';
import { KafkaPluginOptions } from './kafka-plugin-options';
import { KAFKA_LOGGER, KAFKA_OPTIONS } from '../di';
import { PluginNotConfiguredError } from '@axisparkjs/core';
import { Injectable, InjectableScopes, InjectionToken, Injector } from '@axisparkjs/di';
import { KafkaConnectionManager } from '../connections';

/**
 * A plugin for integrating Kafka into the application.
 */
@Injectable()
export class KafkaPlugin extends Plugin {
    private context: AxiSparkContext;
    protected options: KafkaPluginOptions;
    private connectionManager: KafkaConnectionManager;

    constructor(
        private logger: Logger,
        private readonly injector: Injector
    ) {
        super();
    }

    async onRegister(context: AxiSparkContext, options?: KafkaPluginOptions): Promise<void> {
        if (!options) throw new PluginNotConfiguredError(KafkaPlugin.name);
        this.context = context;
        this.options = options;
        this.logger = this.logger.child('KafkaPlugin');

        this.registerContainerBindings();
        await this.startConnectionManager();

        await this.logger.info(`Plugin registered`);
    }

    private async startConnectionManager(): Promise<void> {
        this.connectionManager = await this.injector.get<KafkaConnectionManager>(KafkaConnectionManager);
        await this.connectionManager.createConnections();
        const connections = this.connectionManager.getAllConnections();

        for (const [name, connection] of connections.entries()) {
            this.context.container.bind({ token: new InjectionToken(`KAFKA_CONNECTION_${name}`), useValue: connection });
            const consumer = this.connectionManager.getConsumer(name);
            const producer = this.connectionManager.getProducer(name);

            if (producer) {
                this.context.container.bind({ token: new InjectionToken(`KAFKA_PRODUCER_${name}`), useValue: producer });
            } else {
                this.context.container.bind({
                    token: new InjectionToken(`KAFKA_PRODUCER_${name}`),
                    useFactory: async () => {
                        return await this.connectionManager.createProducer(name);
                    },
                    forClass: Object,
                    scope: InjectableScopes.Singleton
                });
            }

            if (consumer) {
                this.context.container.bind({ token: new InjectionToken(`KAFKA_CONSUMER_${name}`), useValue: consumer });
            } else {
                this.context.container.bind({
                    token: new InjectionToken(`KAFKA_CONSUMER_${name}`),
                    useFactory: async () => {
                        return await this.connectionManager.createConsumer(name);
                    },
                    forClass: Object,
                    scope: InjectableScopes.Singleton
                });
            }
        }
    }

    private registerContainerBindings(): void {
        this.context.container.bind({ token: KAFKA_OPTIONS, useValue: this.options });
        this.context.container.bind({ token: KAFKA_LOGGER, useValue: this.logger });
    }

    async onStart(): Promise<void> {
        await this.logger.info(`Plugin started`);
    }

    async onStop(): Promise<void> {
        await this.connectionManager?.destroyConnections();
        await this.logger.info(`Plugin stopped`);
    }
}
