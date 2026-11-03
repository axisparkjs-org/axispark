import { PluginOptions } from '@axisparkjs/core';
import { AmqpConnectionManagerOptions, ConnectionUrl } from 'amqp-connection-manager';

/**
 * Interface representing the options for configuring the RabbitMQ plugin.
 */
export interface RabbitMQPluginOptions extends PluginOptions {
    /**
     * An array of connection configurations for RabbitMQ. Each configuration includes the connection URL(s) and options for the connection manager.
     */
    connections: {
        /**
         * The name of the connection. This name is used to identify the connection in logs and error messages. It should be unique for each connection configuration.
         * Use CONSTANT_CASE for the name to ensure consistency and avoid conflicts with other connection names.
         */
        name: string;
        /**
         * The connection URL(s) for RabbitMQ. This can be a single URL, an array of URLs, or null/undefined if not specified.
         * The connection manager will attempt to connect to the provided URLs in order.
         * If multiple URLs are provided, the connection manager will try each URL until a successful connection is established.
         * If no URLs are provided, the connection manager will not attempt to connect.
         */
        url: ConnectionUrl | ConnectionUrl[];

        /**
         * The options for the connection manager. These options are passed to the AmqpConnectionManager when creating a new connection.
         * The options can include settings such as heartbeat interval, reconnect behavior, and other connection-related configurations.
         * If no options are provided, the connection manager will use its default settings.
         */
        options?: AmqpConnectionManagerOptions;
    }[];

    /**
     * Whether a health check is registered in the `HealthEngine` for each connection. Defaults to `true`.
     */
    healthChecks?: boolean;
}
