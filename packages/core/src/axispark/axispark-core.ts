import { Lifecycle } from '@axisparkjs/common';
import { PluginType, PluginOptions } from '../plugin';
import { AxiSparkContext } from './axispark-context';
import { Token } from '@axisparkjs/di';

/**
 * A class representing the core of the Axispark framework. It implements the `Lifecycle` interface, which includes methods for initialization, running, and destruction of the application. The `AxiSparkCore` class manages the lifecycle of the application, including initializing the context, running the application, and handling shutdown signals.
 *
 * The `AxiSparkCore` class provides methods to register plugins, retrieve used plugins, and resolve dependencies from the dependency injection container. It serves as the main entry point for managing the application's lifecycle and coordinating various components and services within the Axispark framework.
 */
export class AxiSparkCore<TSettings extends object = object> implements Lifecycle {
    private shutdown!: Promise<void>;
    private resolveShutdown!: () => void;
    private keepAlive!: NodeJS.Timeout;

    public constructor(private readonly axisparkContext: AxiSparkContext<TSettings>) {}

    public get config() {
        return this.axisparkContext.config;
    }

    /**
     * The application settings, loaded and validated when the application was created from the `settings` option. They are available before `init()`, to build the options of the plugins. The object is deeply frozen, and it is empty without the `settings` option.
     */
    public get settings() {
        return this.axisparkContext.settings;
    }

    public async init() {
        // Banner logic here
        if (this.axisparkContext.config.banner) {
            await this.axisparkContext.logger.info(`
    ╔═════════════════════════════════════════════╗
    ║                                             ║
    ║                 AxiSpark.js                 ║
    ║                                             ║
    ║      Fast • Modular • TypeScript First      ║
    ║                                             ║
    ╚═════════════════════════════════════════════╝
            `);
        }

        // Initialization logic here
        await this.axisparkContext.scanner.scan();
        this.axisparkContext.container.init();
        await this.axisparkContext.plugins.init(this.axisparkContext);
        await this.axisparkContext.logger.info('App initialized');
    }

    private async keepAliveCallback() {
        // This function is intentionally left empty to keep the event loop alive.
    }

    public async run(): Promise<void> {
        this.keepAlive = setInterval(this.keepAliveCallback.bind(this), 60_000);
        this.shutdown = new Promise((resolve) => {
            this.resolveShutdown = resolve;
        });
        await this.axisparkContext.plugins.run(this.axisparkContext);
        await this.axisparkContext.logger.info('App running, waiting for termination signal...');

        process.once('SIGINT', () => this.resolveShutdown());
        process.once('SIGTERM', () => this.resolveShutdown());

        if (this.axisparkContext.privateConfig.wait) await this.shutdown;
    }

    public async destroy() {
        // Cleanup logic here
        this.keepAliveCallback();
        clearInterval(this.keepAlive);
        await this.axisparkContext.plugins.destroy(this.axisparkContext);
        await this.axisparkContext.logger.info('App destroyed');
    }

    public use(plugin: PluginType, options?: PluginOptions): this {
        this.axisparkContext.plugins.register(plugin, options);
        return this;
    }

    public used(): readonly { type: PluginType; options?: PluginOptions }[] {
        return this.axisparkContext.plugins.getAll().map((p) => ({ type: p.type, options: p.options }));
    }

    public async get<T>(token: Token<T>): Promise<T> {
        return await this.axisparkContext.container.resolve(token);
    }
}
