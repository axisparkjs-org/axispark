/**
 * An interface representing the private configuration options for AxiSpark. It defines optional properties that can be used to customize the behavior of the AxiSpark instance. The `scanner` property allows specifying the type of scanner to use, either 'file-system' or 'null', while the `wait` property indicates whether to wait for certain operations to complete before proceeding.
 *
 * Properties:
 * - `scanner`: An optional string that can be either 'file-system' or 'null', indicating the type of scanner to use for discovering modules or components.
 * - `wait`: An optional boolean indicating whether to wait for certain operations to complete before proceeding. This can be useful in scenarios where asynchronous initialization is required.
 */
export interface AxiSparkPrivateConfig {
    /**
     * An optional string that can be either 'file-system' or 'null', indicating the type of scanner to use for discovering modules or components. The 'file-system' option enables scanning the file system for modules, while the 'null' option disables scanning.
     */
    scanner?: 'file-system' | 'null';

    /**
     * An optional boolean indicating whether to wait for certain operations to complete before proceeding. If set to `true`, the AxiSpark instance will wait for asynchronous initialization tasks to finish before continuing. If set to `false`, the instance will proceed without waiting.
     */
    wait?: boolean;

    /**
     * An optional settings object used instead of loading the `settings` option of the configuration. The environment is not read. It is used by the test factory to replace the settings.
     */
    settings?: object;
}
