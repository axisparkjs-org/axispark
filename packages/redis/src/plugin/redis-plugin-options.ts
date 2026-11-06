import { PluginOptions } from '@axisparkjs/core';
import { RedisClientOptions } from 'redis';

/**
 * The configuration of a named Redis connection.
 */
export interface RedisConnectionOptions {
    /**
     * The name of the connection. This name is used to inject the connection and to identify it in logs and health checks. It should be unique for each connection configuration.
     * Use CONSTANT_CASE for the name to ensure consistency and avoid conflicts with other connection names.
     */
    name: string;

    /**
     * The connection URL, such as `redis://user:password@host:6379/0`, or `rediss://` for TLS.
     */
    url: string;

    /**
     * The client options passed to `createClient`, such as the socket, TLS, database or reconnect strategy settings.
     * The `url` of the connection takes precedence over the `url` of these options.
     */
    options?: Omit<RedisClientOptions, 'url'>;
}

/**
 * Interface representing the options for configuring the Redis plugin.
 */
export interface RedisPluginOptions extends PluginOptions {
    /**
     * An array of named connection configurations for Redis.
     */
    connections: RedisConnectionOptions[];

    /**
     * Whether a health check is registered in the `HealthEngine` for each connection. Defaults to `true`.
     */
    healthChecks?: boolean;

    /**
     * Whether the plugin fails to register when a connection cannot be established at startup. Defaults to `false`: the clients keep
     * reconnecting in the background, the errors are logged and the connections are reported as unhealthy until they are ready.
     */
    failOnConnectError?: boolean;
}
