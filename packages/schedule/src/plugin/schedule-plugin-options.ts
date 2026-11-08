import { PluginOptions } from '@axisparkjs/core';
import { StoreProvider } from '@axisparkjs/store';

/**
 * The default maximum time to wait for the running jobs when the application stops, in milliseconds. It is lower than the 30 seconds
 * that orchestrators such as Kubernetes wait by default before killing the process, so the warning about the jobs still running is logged.
 */
export const DEFAULT_SHUTDOWN_TIMEOUT = 25_000;

/**
 * Interface representing the options for configuring the schedule plugin.
 */
export interface SchedulePluginOptions extends PluginOptions {
    /**
     * The provider of the store of the locks of the exclusive jobs, called when the plugin starts. Defaults to `MemoryStore()`, which only
     * coordinates the jobs of one process. Use a shared provider, such as `RedisStore('NAME')` from `@axisparkjs/redis`, so an exclusive job
     * runs on only one instance of the application.
     */
    lockStore?: StoreProvider<'lock'>;
    /**
     * The maximum time to wait for the running jobs when the application stops, in milliseconds. Defaults to `DEFAULT_SHUTDOWN_TIMEOUT`
     * (25 seconds). `0` does not wait. The jobs that are still running when it ends are logged as a warning.
     */
    shutdownTimeout?: number;
}
