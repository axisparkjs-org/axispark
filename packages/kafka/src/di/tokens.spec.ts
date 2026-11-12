import { Metadata, MetadataKeys } from '@axisparkjs/common';
import {
    InjectKafkaConnection,
    InjectKafkaConsumer,
    InjectKafkaProducer,
    KAFKA_LOGGER,
    KAFKA_OPTIONS,
    kafkaConnectionToken,
    kafkaConsumerToken,
    kafkaProducerToken
} from './tokens';

describe('Kafka injection tokens', () => {
    it('exports stable tokens for plugin options and logger', () => {
        expect(KAFKA_OPTIONS.description).toBe('KAFKA_OPTIONS');
        expect(KAFKA_LOGGER.description).toBe('KAFKA_LOGGER');
    });

    it('creates injection decorators for named Kafka connections, producers, and consumers', () => {
        class KafkaDependencies {}
        InjectKafkaConnection('PRIMARY')(KafkaDependencies, undefined, 0);
        InjectKafkaProducer('PRIMARY')(KafkaDependencies, undefined, 1);
        InjectKafkaConsumer('PRIMARY')(KafkaDependencies, undefined, 2);
        const metadata = Metadata.get<{ params: Map<number, { description: string }> }>(MetadataKeys.INJECT, KafkaDependencies);

        expect(metadata?.params.get(0)?.description).toBe('KAFKA_CONNECTION_PRIMARY');
        expect(metadata?.params.get(1)?.description).toBe('KAFKA_PRODUCER_PRIMARY');
        expect(metadata?.params.get(2)?.description).toBe('KAFKA_CONSUMER_PRIMARY');
        expect(metadata?.params.get(0)).toBe(kafkaConnectionToken('PRIMARY'));
        expect(metadata?.params.get(1)).toBe(kafkaProducerToken('PRIMARY'));
        expect(metadata?.params.get(2)).toBe(kafkaConsumerToken('PRIMARY'));
    });

    it('returns the same token instance for the same connection name', () => {
        expect(kafkaConnectionToken('PRIMARY')).toBe(kafkaConnectionToken('PRIMARY'));
        expect(kafkaProducerToken('PRIMARY')).toBe(kafkaProducerToken('PRIMARY'));
        expect(kafkaConsumerToken('PRIMARY')).toBe(kafkaConsumerToken('PRIMARY'));
        expect(kafkaConnectionToken('PRIMARY')).not.toBe(kafkaConnectionToken('REPORTS'));
    });
});
