import { AxiSparkContext, HealthEngine, Plugin } from '@axisparkjs/core';
import { Logger } from '@axisparkjs/logger';
import { RedisPluginOptions } from './redis-plugin-options';
import { REDIS_LOGGER, REDIS_OPTIONS, redisConnectionToken } from '../di';
import { PluginNotConfiguredError } from '@axisparkjs/core';
import { Injectable, Injector } from '@axisparkjs/di';
import { RedisConnectionManager } from '../connections';
import { RedisHealthIndicator } from '../health';

/**
 * A plugin for integrating Redis into the application.
 */
@Injectable()
export class RedisPlugin extends Plugin {
    private context: AxiSparkContext;
    protected options: RedisPluginOptions;
    private connectionManager: RedisConnectionManager;

    constructor(
        private logger: Logger,
        private readonly injector: Injector
    ) {
        super();
    }

    async onRegister(context: AxiSparkContext, options?: RedisPluginOptions): Promise<void> {
        if (!options) throw new PluginNotConfiguredError(RedisPlugin.name);
        this.context = context;
        this.options = options;
        this.logger = this.logger.child('RedisPlugin');

        this.registerContainerBindings();
        await this.startConnectionManager();
        await this.registerHealthChecks();

        await this.logger.info(`Plugin registered`);
    }

    private async startConnectionManager(): Promise<void> {
        this.connectionManager = await this.injector.get<RedisConnectionManager>(RedisConnectionManager);
        await this.connectionManager.createConnections();
        const connections = this.connectionManager.getAllConnections();

        for (const [name, connection] of connections.entries()) {
            this.context.container.bind({ token: redisConnectionToken(name), useValue: connection });
        }
    }

    private async registerHealthChecks(): Promise<void> {
        if (this.options.healthChecks === false) return;

        const healthEngine = await this.injector.get(HealthEngine);
        for (const [name, connection] of this.connectionManager.getAllConnections().entries()) {
            healthEngine.register(new RedisHealthIndicator(connection), { name: `redis:${name}` });
        }
    }

    private registerContainerBindings(): void {
        this.context.container.bind({ token: REDIS_OPTIONS, useValue: this.options });
        this.context.container.bind({ token: REDIS_LOGGER, useValue: this.logger });
    }

    async onStart(): Promise<void> {
        await this.logger.info(`Plugin started`);
    }

    async onStop(): Promise<void> {
        await this.connectionManager?.destroyConnections();
        await this.logger.info(`Plugin stopped`);
    }
}
