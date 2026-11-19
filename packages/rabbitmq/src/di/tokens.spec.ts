import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { InjectRabbitMQConnection, RABBITMQ_LOGGER, RABBITMQ_OPTIONS, rabbitMQConnectionToken } from './tokens';

describe('RabbitMQ injection tokens', () => {
    it('exports stable tokens for plugin options and logger', () => {
        expect(RABBITMQ_OPTIONS.description).toBe('RABBITMQ_OPTIONS');
        expect(RABBITMQ_LOGGER.description).toBe('RABBITMQ_LOGGER');
    });

    it('creates an injection decorator for the named RabbitMQ connection', () => {
        const connectionDecorator = InjectRabbitMQConnection('PRIMARY');
        class Consumer {}
        connectionDecorator(Consumer, undefined, 0);
        const metadata = Metadata.get<{ params: Map<number, { description: string }> }>(MetadataKeys.INJECT, Consumer);

        expect(metadata?.params.get(0)?.description).toBe('RABBITMQ_CONNECTION_PRIMARY');
        expect(metadata?.params.get(0)).toBe(rabbitMQConnectionToken('PRIMARY'));
    });

    it('returns the same token instance for the same connection name', () => {
        expect(rabbitMQConnectionToken('PRIMARY')).toBe(rabbitMQConnectionToken('PRIMARY'));
        expect(rabbitMQConnectionToken('PRIMARY')).not.toBe(rabbitMQConnectionToken('REPORTS'));
    });
});
