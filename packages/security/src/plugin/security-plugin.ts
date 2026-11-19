import { AxiSparkContext, Plugin } from '@axisparkjs/core';
import { Logger } from '@axisparkjs/logger';
import { SecurityPluginOptions } from './security-plugin-options';
import { SECURITY_LOGGER, SECURITY_OPTIONS } from '../di';
import { PluginNotConfiguredError } from '@axisparkjs/core';
import { Injectable } from '@axisparkjs/di';

/**
 * Registers security configuration and lifecycle integration with AxiSpark.
 *
 * The global authentication and authorization middleware and guards provide
 * the execution pipeline; this plugin binds its options and logger into the
 * application's dependency injection container. Applications customize
 * authentication and authorization by providing their own injectable
 * {@link Authenticator} and {@link AuthorizationPolicy} implementations.
 */
@Injectable()
export class SecurityPlugin extends Plugin {
    private context: AxiSparkContext;
    declare protected options: SecurityPluginOptions;

    /** @param logger Application logger used to create the plugin's scoped logger. */
    constructor(private logger: Logger) {
        super();
    }

    /**
     * Binds the security options and scoped logger into the application
     * container.
     *
     * @param context Running application context.
     * @param options Required security plugin configuration.
     * @throws PluginNotConfiguredError when options are omitted.
     */
    async onRegister(context: AxiSparkContext, options?: SecurityPluginOptions): Promise<void> {
        if (!options) throw new PluginNotConfiguredError(SecurityPlugin.name);
        this.context = context;
        this.options = options;
        this.logger = this.logger.child('SecurityPlugin');

        this.registerContainerBindings();

        await this.logger.info(`Plugin registered`);
    }

    private registerContainerBindings(): void {
        this.context.container.bind({ token: SECURITY_OPTIONS, useValue: this.options });
        this.context.container.bind({ token: SECURITY_LOGGER, useValue: this.logger });
    }

    /** Logs that the security plugin has started. */
    async onStart(): Promise<void> {
        await this.logger.info(`Plugin started`);
    }

    /** Logs that the security plugin has stopped. */
    async onStop(): Promise<void> {
        await this.logger.info(`Plugin stopped`);
    }
}
