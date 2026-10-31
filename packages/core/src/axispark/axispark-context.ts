import { ConsoleTransport, Logger, LogLevel, SimpleFormatter, LogTransport } from '@axisparkjs/logger';
import { PluginRegistry } from '../plugin';
import { Container, Injector, ScopedContainerManager } from '@axisparkjs/di';
import { AxiSparkConfig, AXISPARK_CONFIG } from './axispark-config';
import { Scanner, FileSystemScanner, NullScanner } from '../scanner';
import { HealthEngine } from '../health';
import { AxiSparkPrivateConfig } from './axispark-private-config';

/**
 * A class representing the context of the Axispark framework. It encapsulates various components and services that are essential for the operation of the framework, including logging, plugin management, dependency injection, configuration, and scanning capabilities.
 *
 * The `AxiSparkContext` class provides a centralized context for managing the state and behavior of the Axispark framework. It initializes and configures essential services such as logging, plugin registry, dependency injection container, and scanner based on the provided configuration options.
 */
export class AxiSparkContext {
    public readonly logger: Logger;
    public readonly plugins: PluginRegistry;
    public readonly container: Container;
    public readonly config: AxiSparkConfig;
    public readonly privateConfig: AxiSparkPrivateConfig;
    public readonly scanner: Scanner;

    public constructor(config?: AxiSparkConfig, privateConfig?: AxiSparkPrivateConfig) {
        this.config = {
            name: 'App',
            environment: 'development',
            banner: true,
            logTransports: [new ConsoleTransport({ formatter: new SimpleFormatter(), minLevel: LogLevel.Trace })],
            ...config
        };
        this.privateConfig = {
            scanner: 'file-system',
            wait: true,
            ...privateConfig
        };
        this.logger = new Logger(this.config.logTransports as LogTransport[], [this.config.name as string]);
        this.plugins = new PluginRegistry();
        this.container = new Container();

        this.scanner = this.privateConfig.scanner === 'null' ? new NullScanner() : new FileSystemScanner(this.config.basePath);

        this.container.bind({
            token: AXISPARK_CONFIG,
            useValue: this.config
        });
        this.container.bind({
            token: Logger,
            useValue: this.logger
        });

        const injector = new Injector(this.container);
        this.container.bind({
            token: Injector,
            useValue: injector
        });

        const scopedContainerManager = new ScopedContainerManager(this.container);
        this.container.bind({
            token: ScopedContainerManager,
            useValue: scopedContainerManager
        });

        const healthEngine = new HealthEngine(this.config, this.plugins, this.container);
        this.container.bind({
            token: HealthEngine,
            useValue: healthEngine
        });
    }
}
