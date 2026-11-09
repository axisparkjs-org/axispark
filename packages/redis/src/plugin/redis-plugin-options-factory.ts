import { Factory } from '@axisparkjs/common';
import { RedisPluginOptions } from './redis-plugin-options';
import { RedisPlugin } from './redis-plugin';

/**
 * A factory for creating RedisPluginOptions instances.
 */
export class RedisPluginOptionsFactoryStatic implements Factory<RedisPluginOptions> {
    create(options: Omit<RedisPluginOptions, 'plugin'>): RedisPluginOptions {
        return {
            plugin: RedisPlugin,
            healthChecks: true,
            ...options
        };
    }
}

/**
 * A factory for creating RedisPluginOptions instances.
 */
export const RedisPluginOptionsFactory = new RedisPluginOptionsFactoryStatic();
