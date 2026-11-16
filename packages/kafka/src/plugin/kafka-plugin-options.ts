import { PluginOptions } from '@axisparkjs/core';
import { ConsumerConfig, KafkaConfig, LibrdkafkaConfig, ProducerConfig } from '../client';

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
         * It is the KafkaJS-compatible configuration of `@confluentinc/kafka-javascript` (brokers, client ID, SSL, SASL, timeouts, retries and logging),
         * passed to the client in its `kafkaJS` block.
         */
        config: KafkaConfig;
        /**
         * Optional librdkafka properties of the client (for example `'statistics.interval.ms'`), passed next to the `kafkaJS` block.
         * Do not repeat here a property that `config` already sets.
         */
        librdkafkaConfig?: LibrdkafkaConfig;
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
         * The KafkaJS-compatible configuration of the consumer, passed in its `kafkaJS` block. The group ID defaults to `<name-lowercase>-group`.
         * `fromBeginning`, `autoCommit` and `autoCommitInterval` are set here, not in `subscribe()` or `run()`.
         */
        consumerConfig?: Partial<ConsumerConfig>;
        /**
         * The KafkaJS-compatible configuration of the producer, passed in its `kafkaJS` block. `acks`, `compression` and `timeout` are set here, not in `send()`.
         */
        producerConfig?: ProducerConfig;
    }[];

    /**
     * Whether a health check is registered in the `HealthEngine` for each connection. Defaults to `true`.
     */
    healthChecks?: boolean;
}
