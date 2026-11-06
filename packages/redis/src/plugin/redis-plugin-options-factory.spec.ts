import { RedisPlugin } from './redis-plugin';
import { RedisPluginOptionsFactory, RedisPluginOptionsFactoryStatic } from './redis-plugin-options-factory';

describe('RedisPluginOptionsFactoryStatic', () => {
    it('creates plugin options with the Redis plugin, the defaults and the supplied connections', () => {
        const connections = [{ name: 'CACHE', url: 'redis://localhost:6379/0' }];

        expect(new RedisPluginOptionsFactoryStatic().create({ connections })).toEqual({
            plugin: RedisPlugin,
            healthChecks: true,
            failOnConnectError: false,
            connections
        });
    });

    it('overrides the default options', () => {
        expect(RedisPluginOptionsFactory.create({ connections: [], healthChecks: false, failOnConnectError: true })).toEqual({
            plugin: RedisPlugin,
            healthChecks: false,
            failOnConnectError: true,
            connections: []
        });
    });
});
