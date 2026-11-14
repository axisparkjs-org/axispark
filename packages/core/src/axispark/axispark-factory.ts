import { Factory } from '@axisparkjs/common';
import { AxiSparkContext } from './axispark-context';
import { AxiSparkCore } from './axispark-core';
import { AxiSparkConfig } from './axispark-config';

/**
 * Static factory class for creating instances of AxiSparkCore. This class implements the Factory interface and provides a method to create AxiSparkCore instances with an optional configuration.
 */
export class AxiSparkFactoryStatic implements Factory<AxiSparkCore> {
    /**
     * Creates a new instance of AxiSparkCore with the provided configuration. If no configuration is provided, a default configuration will be used. The method sets up the necessary context and returns a new instance of AxiSparkCore.
     * @param config Optional configuration object for customizing the AxiSparkCore instance. If not provided, default settings will be applied.
     * The type of `app.settings` is inferred from the return type of the `load` function of the `settings` option. When the settings are not valid, an `InvalidSettingsError` listing every problem is thrown.
     * @returns A new instance of AxiSparkCore configured with the provided settings.
     */
    public create<TSettings extends object = object>(config?: AxiSparkConfig<TSettings>): AxiSparkCore<TSettings> {
        // Perform any necessary setup or configuration here
        const context = new AxiSparkContext<TSettings>(config);
        return new AxiSparkCore<TSettings>(context);
    }
}

/**
 * A static factory for creating instances of AxiSparkCore. It provides a `create` method that can be called with an optional `AxiSparkConfig` object to customize the configuration of the instance. The factory sets up a context based on the provided configuration and returns a new instance of AxiSparkCore.
 */
export const AxiSparkFactory = new AxiSparkFactoryStatic();
