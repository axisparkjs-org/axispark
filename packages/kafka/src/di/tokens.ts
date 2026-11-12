import { InjectionToken, Inject, createTokenFactory } from '@axisparkjs/di';

/** Injection token for the Kafka options. */
export const KAFKA_OPTIONS = new InjectionToken('KAFKA_OPTIONS');
/** Injection token for the Kafka logger. */
export const KAFKA_LOGGER = new InjectionToken('KAFKA_LOGGER');

/** Returns the injection token of a named Kafka connection, the same instance for the same name. */
export const kafkaConnectionToken = createTokenFactory((name: string) => `KAFKA_CONNECTION_${name}`);
/** Returns the injection token of the producer of a named Kafka connection, the same instance for the same name. */
export const kafkaProducerToken = createTokenFactory((name: string) => `KAFKA_PRODUCER_${name}`);
/** Returns the injection token of the consumer of a named Kafka connection, the same instance for the same name. */
export const kafkaConsumerToken = createTokenFactory((name: string) => `KAFKA_CONSUMER_${name}`);

/** Inject decorator for a specific Kafka connection. */
export const InjectKafkaConnection = (name: string) => Inject(kafkaConnectionToken(name));
/** Inject decorator for the producer of a specific Kafka connection. */
export const InjectKafkaProducer = (name: string) => Inject(kafkaProducerToken(name));
/** Inject decorator for the consumer of a specific Kafka connection. */
export const InjectKafkaConsumer = (name: string) => Inject(kafkaConsumerToken(name));
