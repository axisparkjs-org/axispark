import { Factory } from '@axisparkjs/common';
import { DEFAULT_SHUTDOWN_TIMEOUT, SchedulePluginOptions } from './schedule-plugin-options';
import { SchedulePlugin } from './schedule-plugin';

/**
 * A factory for creating SchedulePluginOptions instances.
 */
export class SchedulePluginOptionsFactoryStatic implements Factory<SchedulePluginOptions> {
    create(options: Omit<SchedulePluginOptions, 'plugin'> = {}): SchedulePluginOptions {
        return {
            plugin: SchedulePlugin,
            shutdownTimeout: DEFAULT_SHUTDOWN_TIMEOUT,
            ...options
        };
    }
}

/**
 * A factory for creating SchedulePluginOptions instances.
 */
export const SchedulePluginOptionsFactory = new SchedulePluginOptionsFactoryStatic();
