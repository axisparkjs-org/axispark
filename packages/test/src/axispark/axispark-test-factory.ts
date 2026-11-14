import { Factory } from '@axisparkjs/common';
import { AxiSparkTestConfig } from './axispark-test-config';
import { AxiSparkContext, AxiSparkCore } from '@axisparkjs/core';
import { NullTransport, LogLevel, SimpleFormatter } from '@axisparkjs/logger';

/**
 * A static factory for creating test instances of AxiSparkCore.
 */
export class AxiSparkTestFactoryStatic implements Factory<AxiSparkCore> {
    /**
     * Creates a new instance of AxiSparkCore for testing purposes.
     * @param config Optional configuration for the test instance, including app settings and providers.
     * @returns A new instance of AxiSparkCore configured for testing.
     */
    public create<TSettings extends object = object>(config?: AxiSparkTestConfig & { settings?: TSettings }): AxiSparkCore<TSettings> {
        // Perform any necessary setup or configuration here
        const context = new AxiSparkContext<TSettings>(
            {
                ...config?.app?.config,
                banner: false,
                environment: 'test',
                name: 'Test',
                logTransports: [new NullTransport({ formatter: new SimpleFormatter(), minLevel: LogLevel.Error })]
            },
            {
                scanner: 'file-system',
                wait: false,
                settings: config?.settings ?? config?.app?.settings
            }
        );

        if (config?.app) config.app.used().forEach((plugin) => context.plugins.register(plugin.type, plugin.options));

        const providers = config?.providers || [];
        providers.forEach((provider) => context.container.bind(provider));

        return new AxiSparkCore<TSettings>(context);
    }
}

/**
 * A factory for creating test instances of AxiSparkCore. It provides a `create` method that can be called with an optional `AxiSparkTestConfig` object to customize the configuration of the test instance. The factory sets up a test context with default settings, including a null log transport and a test environment, and allows for the registration of plugins and providers as specified in the configuration.
 */
export const AxiSparkTestFactory = new AxiSparkTestFactoryStatic();
