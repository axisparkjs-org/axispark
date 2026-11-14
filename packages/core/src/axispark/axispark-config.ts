import { InjectionToken } from '@axisparkjs/di';
import { LogTransport } from '@axisparkjs/logger';
import { ScannerOptions } from '../scanner/scanner-options';
import { SettingsOptions } from '../settings/settings-options';

/**
 * An injection token used to provide configuration options for the Axispark framework. This token can be used to inject an instance of `AxiSparkConfig` into components or services that require access to the configuration settings.
 *
 * The `AxiSparkConfig` interface defines the shape of the configuration object, which includes optional properties such as `name`, `basePath`, `environment`, `banner`, and `logTransports`. These properties allow developers to customize the behavior and settings of the Axispark framework according to their application's needs.
 *
 * Example usage:
 *
 * ```typescript
 * import { AXISPARK_CONFIG, AxiSparkConfig } from '@axisparkjs/core';
 * import { Injectable, Inject } from '@axisparkjs/di';
 *
 * @Injectable()
 * class MyService {
 *   constructor(@Inject(AXISPARK_CONFIG) private config: AxiSparkConfig) {}
 * }
 * ```
 */
export const AXISPARK_CONFIG = new InjectionToken('AXISPARK_CONFIG');

/**
 * An interface representing the configuration options for the Axispark framework. It defines optional properties that can be used to customize the behavior and settings of the framework.
 *
 * Properties:
 * - `name`: An optional string representing the name of the application or module.
 * - `basePath`: An optional string representing the base path for the application or module.
 * - `environment`: An optional string that can be either 'production', 'development', or 'test', indicating the current environment of the application.
 * - `banner`: An optional boolean indicating whether to display a banner in the console when the application starts.
 * - `logTransports`: An optional array of `LogTransport` instances that define how logs should be handled and where they should be sent.
 * - `scanner`: Optional `include` and `exclude` glob patterns that select the files loaded from `basePath`.
 * - `settings`: Optional application settings, read from the environment variables and the `.env` files and validated when the application is created.
 *
 * Example usage:
 *
 * ```typescript
 * const config: AxiSparkConfig = {
 *     name: 'Example App',
 *     basePath: __dirname,
 *     logTransports: [
 *         new ConsoleTransport({
 *             minLevel: LogLevel.Info,
 *             formatter: new SimpleFormatter()
 *         })
 *     ]
 * };
 * ```
 */
export interface AxiSparkConfig<TSettings extends object = object> {
    /**
     * An optional string representing the name of the application or module. This can be used for identification purposes in logs or other outputs.
     */
    name?: string;

    /**
     * An optional string representing the base path for the application or module. This can be used to resolve relative paths for resources or configuration files.
     */
    basePath?: string;

    /**
     * An optional string that can be either 'production', 'development', or 'test', indicating the current environment of the application. This can be used to conditionally enable or disable features based on the environment.
     */
    environment?: 'production' | 'development' | 'test';

    /**
     * An optional boolean indicating whether to display a banner in the console when the application starts. If set to true, a banner will be displayed; if false, no banner will be shown.
     */
    banner?: boolean;

    /**
     * An optional array of `LogTransport` instances that define how logs should be handled and where they should be sent. This allows for customization of logging behavior, such as sending logs to different outputs or formatting them in specific ways.
     */
    logTransports?: LogTransport[];

    /**
     * Optional `include` and `exclude` glob patterns that select the files loaded by the scanner from `basePath`. Importing a file runs its top-level code, so exclude the files that must not be loaded, such as scripts or files that create other applications.
     *
     * By default, every `.js` and `.ts` file is loaded, except the `node_modules`, `dist` and `coverage` folders, the declaration files, the bootstrap files (`*.bootstrap.{js,ts}`) and the test files (`*.spec.{js,ts}` and `*.test.{js,ts}`). The `exclude` patterns are added to these exclusions.
     */
    scanner?: ScannerOptions;

    /**
     * Optional application settings: values read from the environment variables and from `.env` files, converted to their types and validated when the application is created. The settings are available in `app.settings`, to build the plugin options, and by injection with `@EnvSettings()` or the `AXISPARK_ENV_SETTINGS` token.
     *
     * When a variable is missing or invalid, the application is not created and an `InvalidSettingsError` lists every problem.
     */
    settings?: SettingsOptions<TSettings>;
}
