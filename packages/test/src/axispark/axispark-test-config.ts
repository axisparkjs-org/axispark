import { ClassType } from '@axisparkjs/common';
import { AxiSparkCore } from '@axisparkjs/core';
import { Provider } from '@axisparkjs/di';

/**
 * Configuration options for creating a test instance of AxiSparkCore.
 */
export interface AxiSparkTestConfig {
    /**
     * An array of providers or class types to be used in the test context. These can be mock implementations or real implementations of your application's dependencies.
     */
    providers?: (Provider | ClassType)[];

    /**
     * An optional instance of AxiSparkCore to be used as the application context.
     */
    app?: AxiSparkCore<any>;

    /**
     * An optional settings object that replaces the application settings, without reading the environment or the `.env` files. It is available in `app.settings` and by injection. When it is not provided, the test instance uses the settings already loaded by `app`.
     */
    settings?: object;
}
