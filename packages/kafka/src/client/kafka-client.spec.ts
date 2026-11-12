import { KafkaJS } from '@confluentinc/kafka-javascript';
import { createKafkaClient } from './kafka-client';

describe('createKafkaClient', () => {
    it('creates a KafkaJS-compatible client of @confluentinc/kafka-javascript', () => {
        const client = createKafkaClient({ brokers: ['localhost:9092'], clientId: 'orders' });

        expect(client).toBeInstanceOf(KafkaJS.Kafka);
        expect(typeof client.producer).toBe('function');
        expect(typeof client.consumer).toBe('function');
        expect(typeof client.admin).toBe('function');
    });

    it('creates a client with librdkafka properties', () => {
        const client = createKafkaClient({ brokers: ['localhost:9092'] }, { 'client.rack': 'rack-1' });

        expect(client).toBeInstanceOf(KafkaJS.Kafka);
    });
});
