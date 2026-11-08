import { PluginOptions } from '@axisparkjs/core';
import { StoreProvider } from '@axisparkjs/store';

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
}
