import { KafkaJS } from '@confluentinc/kafka-javascript';
import { KafkaConnectionManager } from './kafka-connection-manager';

jest.mock('@confluentinc/kafka-javascript', () => ({ KafkaJS: { Kafka: jest.fn() } }));

const kafkaMock = jest.mocked(KafkaJS.Kafka);

describe('KafkaConnectionManager', () => {
    const logger = { info: jest.fn(), error: jest.fn() };
    const producer = () => ({ connect: jest.fn().mockResolvedValue(undefined), disconnect: jest.fn().mockResolvedValue(undefined) });
    const consumer = () => ({ connect: jest.fn().mockResolvedValue(undefined), disconnect: jest.fn().mockResolvedValue(undefined) });
    const connection = (p = producer(), c = consumer()) => ({ producer: jest.fn().mockReturnValue(p), consumer: jest.fn().mockReturnValue(c) });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const createManager = (connections: any[]) => new KafkaConnectionManager({ connections } as any, logger as any);

    it('creates each Kafka client and initializes producer and consumer by default', async () => {
        const primaryProducer = producer();
        const primaryConsumer = consumer();
        const reportingProducer = producer();
        const reportingConsumer = consumer();
        const primary = connection(primaryProducer, primaryConsumer);
        const reporting = connection(reportingProducer, reportingConsumer);
        kafkaMock.mockImplementationOnce(() => primary as any).mockImplementationOnce(() => reporting as any);
        const configs = [
            { name: 'PRIMARY', config: { clientId: 'primary', brokers: ['localhost:9092'] } },
            { name: 'REPORTING', config: { clientId: 'reporting', brokers: ['localhost:9093'] } }
        ];
        const manager = createManager(configs);

        await manager.createConnections();

        expect(kafkaMock).toHaveBeenNthCalledWith(1, { kafkaJS: configs[0].config });
        expect(kafkaMock).toHaveBeenNthCalledWith(2, { kafkaJS: configs[1].config });
        expect(primary.producer).toHaveBeenCalledWith({ kafkaJS: {} });
        expect(primary.consumer).toHaveBeenCalledWith({ kafkaJS: { groupId: 'primary-group' } });
        expect(reporting.producer).toHaveBeenCalledWith({ kafkaJS: {} });
        expect(reporting.consumer).toHaveBeenCalledWith({ kafkaJS: { groupId: 'reporting-group' } });
        expect(primaryProducer.connect).toHaveBeenCalledTimes(1);
        expect(primaryConsumer.connect).toHaveBeenCalledTimes(1);
        expect(manager.getConnection('PRIMARY')).toBe(primary);
        expect(manager.getProducer('PRIMARY')).toBe(primaryProducer);
        expect(manager.getConsumer('PRIMARY')).toBe(primaryConsumer);
    });

    it('passes the librdkafka properties next to the KafkaJS-compatible configuration', async () => {
        kafkaMock.mockReturnValue(connection() as any);
        const config = { brokers: ['localhost:9092'] };
        const manager = createManager([{ name: 'NATIVE', config, librdkafkaConfig: { 'statistics.interval.ms': 1000 }, autoInitialize: false }]);

        await manager.createConnections();

        expect(kafkaMock).toHaveBeenCalledWith({ 'statistics.interval.ms': 1000, kafkaJS: config });
    });

    it('passes producer and consumer configurations to the client in their kafkaJS block', async () => {
        const producerClient = producer();
        const consumerClient = consumer();
        const kafka = connection(producerClient, consumerClient);
        kafkaMock.mockReturnValue(kafka as any);
        const config = {
            name: 'EVENTS',
            config: { brokers: ['localhost:9092'] },
            producerConfig: { idempotent: true },
            consumerConfig: { groupId: 'custom-group', allowAutoTopicCreation: false }
        };
        const manager = createManager([config]);

        await manager.createConnections();

        expect(kafka.producer).toHaveBeenCalledWith({ kafkaJS: { ...config.producerConfig } });
        expect(kafka.consumer).toHaveBeenCalledWith({ kafkaJS: { ...config.consumerConfig } });
    });

    it('supports disabling automatic initialization and creating clients on demand', async () => {
        const kafka = connection();
        kafkaMock.mockReturnValue(kafka as any);
        const manager = createManager([{ name: 'MANUAL', config: { brokers: ['localhost:9092'] }, autoInitialize: false }]);

        await manager.createConnections();

        expect(kafka.producer).not.toHaveBeenCalled();
        expect(kafka.consumer).not.toHaveBeenCalled();
        await manager.createProducer('MANUAL');
        await manager.createConsumer('MANUAL');
        expect(manager.getProducer('MANUAL')).toBeDefined();
        expect(manager.getConsumer('MANUAL')).toBeDefined();
    });

    it('returns undefined when trying to create clients for unknown connections', async () => {
        const manager = createManager([{ name: 'KNOWN', config: { brokers: ['localhost:9092'] }, autoInitialize: false }]);
        await manager.createConnections();

        const unknownProducer = await manager.createProducer('UNKNOWN');
        const unknownConsumer = await manager.createConsumer('UNKNOWN');

        expect(unknownProducer).toBeUndefined();
        expect(unknownConsumer).toBeUndefined();
    });

    it('can selectively initialize consumers or producers', async () => {
        const kafka = connection();
        kafkaMock.mockReturnValue(kafka as any);
        const manager = createManager([
            {
                name: 'SELECTIVE',
                config: { brokers: ['localhost:9092'] },
                autoInitialize: { autoInitializeConsumers: true }
            }
        ]);

        await manager.createConnections();

        expect(kafka.consumer).toHaveBeenCalledTimes(1);
        expect(kafka.producer).not.toHaveBeenCalled();
    });

    it('selectively initializes a producer when requested', async () => {
        const kafka = connection();
        kafkaMock.mockReturnValue(kafka as any);
        const manager = createManager([
            {
                name: 'SELECTIVE',
                config: { brokers: ['localhost:9092'] },
                autoInitialize: { autoInitializeProducers: true }
            }
        ]);

        await manager.createConnections();

        expect(kafka.producer).toHaveBeenCalledTimes(1);
        expect(kafka.consumer).not.toHaveBeenCalled();
    });

    it('initializes both clients when autoInitialize is true', async () => {
        const kafka = connection();
        kafkaMock.mockReturnValue(kafka as any);
        const manager = createManager([
            {
                name: 'AUTOMATIC',
                config: { brokers: ['localhost:9092'] },
                autoInitialize: true
            }
        ]);

        await manager.createConnections();

        expect(kafka.producer).toHaveBeenCalledTimes(1);
        expect(kafka.consumer).toHaveBeenCalledTimes(1);
    });

    it('logs producer initialization errors and returns undefined', async () => {
        const failure = new Error('producer broker unavailable');
        const producerClient = producer();
        producerClient.connect.mockRejectedValue(failure);
        const kafka = connection(producerClient);
        kafkaMock.mockReturnValue(kafka as any);
        const manager = createManager([
            {
                name: 'PRODUCER',
                config: { brokers: ['localhost:9092'] },
                autoInitialize: false
            }
        ]);
        await manager.createConnections();

        await expect(manager.createProducer('PRODUCER')).resolves.toBeUndefined();

        expect(logger.error).toHaveBeenCalledWith("Failed to initialize producer for connection 'PRODUCER'", failure);
        expect(manager.getProducer('PRODUCER')).toBeUndefined();
    });

    it('logs consumer initialization errors and returns undefined', async () => {
        const failure = new Error('consumer broker unavailable');
        const consumerClient = consumer();
        consumerClient.connect.mockRejectedValue(failure);
        const kafka = connection(producer(), consumerClient);
        kafkaMock.mockReturnValue(kafka as any);
        const manager = createManager([
            {
                name: 'CONSUMER',
                config: { brokers: ['localhost:9092'] },
                autoInitialize: false
            }
        ]);
        await manager.createConnections();

        await expect(manager.createConsumer('CONSUMER')).resolves.toBeUndefined();

        expect(logger.error).toHaveBeenCalledWith("Failed to initialize consumer for connection 'CONSUMER'", failure);
        expect(manager.getConsumer('CONSUMER')).toBeUndefined();
    });

    it('catches synchronous client creation errors', async () => {
        const producerFailure = new Error('producer creation failed');
        const consumerFailure = new Error('consumer creation failed');
        const kafka = connection();
        kafka.producer.mockImplementation(() => {
            throw producerFailure;
        });
        kafka.consumer.mockImplementation(() => {
            throw consumerFailure;
        });
        kafkaMock.mockReturnValue(kafka as any);
        const manager = createManager([
            {
                name: 'SYNC_FAILURE',
                config: { brokers: ['localhost:9092'] },
                autoInitialize: false
            }
        ]);
        await manager.createConnections();

        await expect(manager.createProducer('SYNC_FAILURE')).resolves.toBeUndefined();
        await expect(manager.createConsumer('SYNC_FAILURE')).resolves.toBeUndefined();

        expect(logger.error).toHaveBeenCalledWith("Failed to initialize producer for connection 'SYNC_FAILURE'", producerFailure);
        expect(logger.error).toHaveBeenCalledWith("Failed to initialize consumer for connection 'SYNC_FAILURE'", consumerFailure);
    });

    it('rejects duplicate connection names', async () => {
        kafkaMock.mockReturnValue(connection() as any);
        const manager = createManager([
            { name: 'PRIMARY', config: { brokers: ['localhost:9092'] }, autoInitialize: false },
            { name: 'PRIMARY', config: { brokers: ['localhost:9093'] }, autoInitialize: false }
        ]);

        await expect(manager.createConnections()).rejects.toThrow("Connection with name 'PRIMARY' already exists. Connection names must be unique.");
        expect(kafkaMock).toHaveBeenCalledTimes(1);
    });

    it('returns undefined for unknown names and defensive copies of managed clients', async () => {
        const kafka = connection();
        kafkaMock.mockReturnValue(kafka as any);
        const manager = createManager([{ name: 'PRIMARY', config: { brokers: ['localhost:9092'] }, autoInitialize: false }]);
        await manager.createConnections();

        const allConnections = manager.getAllConnections();
        allConnections.clear();

        expect(manager.getConnection('MISSING')).toBeUndefined();
        expect(manager.getConnection('PRIMARY')).toBe(kafka);
        expect(manager.getAllProducers()).toEqual(new Map());
        expect(manager.getAllConsumers()).toEqual(new Map());
    });

    it('disconnects managed clients and clears state on shutdown', async () => {
        const producerClient = producer();
        const consumerClient = consumer();
        const kafka = connection(producerClient, consumerClient);
        kafkaMock.mockReturnValue(kafka as any);
        const manager = createManager([{ name: 'PRIMARY', config: { brokers: ['localhost:9092'] } }]);
        await manager.createConnections();

        await manager.destroyConnections();

        expect(producerClient.disconnect).toHaveBeenCalledTimes(1);
        expect(consumerClient.disconnect).toHaveBeenCalledTimes(1);
        expect(manager.getAllConnections().size).toBe(0);
        expect(manager.getAllProducers().size).toBe(0);
        expect(manager.getAllConsumers().size).toBe(0);
    });

    it('allows creation and destruction when no connections are configured', async () => {
        const manager = createManager([]);

        await expect(manager.createConnections()).resolves.toBeUndefined();
        await expect(manager.destroyConnections()).resolves.toBeUndefined();
        expect(kafkaMock).not.toHaveBeenCalled();
    });
});
