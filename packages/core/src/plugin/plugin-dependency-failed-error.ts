/**
 * Error set as the state error of a plugin that is skipped because one of its required dependencies is in the `Error` state.
 */
export class PluginDependencyFailedError extends Error {
    /**
     * Creates a new instance of the `PluginDependencyFailedError` class.
     * @param name The name of the skipped plugin.
     * @param dependency The name of the dependency in the `Error` state.
     */
    constructor(name: string, dependency: string) {
        super(`Plugin ${name} skipped because its dependency ${dependency} failed`);
        this.name = 'PluginDependencyFailedError';
    }
}
