import { KafkaJS } from '@confluentinc/kafka-javascript';
import type { GlobalConfig } from '@confluentinc/kafka-javascript/types/config';

/**
 * The Kafka client of a connection: the KafkaJS-compatible client of `@confluentinc/kafka-javascript`.
 */
export type Kafka = KafkaJS.Kafka;
/** The producer of a connection. */
export type Producer = KafkaJS.Producer;
/** The consumer of a connection. */
export type Consumer = KafkaJS.Consumer;
/** The admin client created from a connection. */
export type Admin = KafkaJS.Admin;
/** The KafkaJS-compatible configuration of the client: brokers, client ID, SSL, SASL, timeouts, retries and logging. */
export type KafkaConfig = KafkaJS.KafkaConfig;
/** The KafkaJS-compatible configuration of a producer. */
export type ProducerConfig = KafkaJS.ProducerConfig;
/** The KafkaJS-compatible configuration of a consumer. */
export type ConsumerConfig = KafkaJS.ConsumerConfig;
/** The librdkafka properties of the client, for example `'statistics.interval.ms'` or `'client.rack'`. */
export type LibrdkafkaConfig = GlobalConfig;

/**
 * Creates the Kafka client of a connection.
 * @param config The KafkaJS-compatible configuration of the client.
 * @param librdkafkaConfig The librdkafka properties of the client.
 * @returns The Kafka client.
 */
export function createKafkaClient(config: KafkaConfig, librdkafkaConfig?: LibrdkafkaConfig): Kafka {
    return new KafkaJS.Kafka({ ...librdkafkaConfig, kafkaJS: config });
}
