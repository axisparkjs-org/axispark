import { AxiSparkContext, Plugin } from '@axisparkjs/core';
import { Logger } from '@axisparkjs/logger';
import { DataPluginOptions } from './data-plugin-options';
import { DATA_LOGGER, DATA_OPTIONS } from '../di';
import { PluginNotConfiguredError } from '@axisparkjs/core';
import { Injectable, InjectionToken, Injector } from '@axisparkjs/di';
import { DataSourceConnectionManager } from '../connections';
import { RepositoryGenerator } from '../repository/repository-generator';

/**
 * A plugin for integrating Data persistence into the application.
 */
@Injectable()
export class DataPlugin extends Plugin {
    private context: AxiSparkContext;
    protected options: DataPluginOptions;
    private dataSourceConnectionManager: DataSourceConnectionManager;
    private repositoryGenerator: RepositoryGenerator;

    constructor(
        private logger: Logger,
        private readonly injector: Injector
    ) {
        super();
    }

    /**
     * Initializes data sources and registers each decorated repository with the application container.
     *
     * @param context Application context whose container receives the data sources and repositories.
     * @param options Data plugin configuration with one or more named TypeORM sources.
     */
    async onRegister(context: AxiSparkContext, options?: DataPluginOptions): Promise<void> {
        if (!options) throw new PluginNotConfiguredError(DataPlugin.name);
        this.context = context;
        this.options = options;
        this.logger = this.logger.child('DataPlugin');

        this.registerContainerBindings();
        await this.registerDataSourcesAndRepositories();

        await this.logger.info(`Plugin registered`);
    }

    private registerContainerBindings(): void {
        this.context.container.bind({ token: DATA_OPTIONS, useValue: this.options });
        this.context.container.bind({ token: DATA_LOGGER, useValue: this.logger });
    }

    private async registerDataSourcesAndRepositories(): Promise<void> {
        this.dataSourceConnectionManager = await this.injector.get(DataSourceConnectionManager);
        await this.dataSourceConnectionManager.createConnections();
        const dataSources = this.dataSourceConnectionManager.getAllConnections();
        for (const [name, dataSource] of dataSources.entries()) {
            this.context.container.bind({
                token: new InjectionToken(`DATA_SOURCE_${name.toLocaleUpperCase()}`),
                useValue: dataSource
            });
        }

        this.repositoryGenerator = await this.injector.get(RepositoryGenerator);
        const repositoryDefinitions = await this.repositoryGenerator.generate();
        for (const repoDef of repositoryDefinitions) {
            this.context.container.bind({
                token: repoDef.target,
                useValue: repoDef.implementation
            });
            this.context.container.bind({
                token: new InjectionToken(`DATA_REPOSITORY_${repoDef.target.name.toLocaleUpperCase()}`),
                useValue: repoDef.implementation
            });
        }
        await this.logger.info(`Repositories registered: ${repositoryDefinitions.map((r) => r.target.name).join(', ')}`);
    }

    /** Logs that the Data plugin has started. */
    async onStart(): Promise<void> {
        await this.logger.info(`Plugin started`);
    }

    /** Closes every TypeORM data source created by this plugin. */
    async onStop(): Promise<void> {
        await this.dataSourceConnectionManager.destroyConnections();
        await this.logger.info(`Plugin stopped`);
    }
}
