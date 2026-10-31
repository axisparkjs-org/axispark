import { PluginOptions } from '@axisparkjs/core';
import { ConsumerConfig, KafkaConfig, ProducerConfig } from 'kafkajs';

/**
 * Interface representing the options for configuring the Kafka plugin.
 */
export interface KafkaPluginOptions extends PluginOptions {
    /**
     * An array of Kafka client configurations and optional producer/consumer settings.
     */
    connections: {
        /**
         * The name of the connection. This name is used to identify the connection in logs and error messages. It should be unique for each connection configuration.
         * Use CONSTANT_CASE for the name to ensure consistency and avoid conflicts with other connection names.
         */
        name: string;
        /**
         * The connection configuration for Kafka, which includes the necessary settings to establish a connection to the Kafka broker(s).
         * This configuration is passed to the Kafka constructor from the kafkajs library.
         */
        config: KafkaConfig;
        /**
         * Controls whether consumers and producers are connected automatically. A boolean applies to both; an object selects each independently.
         * When omitted, both are initialized. Set false to create them on demand.
         */
        autoInitialize?:
            | boolean
            | {
                  autoInitializeConsumers?: boolean;
                  autoInitializeProducers?: boolean;
              };
        /**
         * The configuration for the Kafka consumer.
         */
        consumerConfig?: Partial<ConsumerConfig>;
        /**
         * The configuration for the Kafka producer.
         */
        producerConfig?: ProducerConfig;
    }[];

    /**
     * Whether a health check is registered in the `HealthEngine` for each connection. Defaults to `true`.
     */
    healthChecks?: boolean;
}
