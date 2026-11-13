import { Injectable, Inject } from '@axisparkjs/di';
import { KAFKA_LOGGER, KAFKA_OPTIONS } from '../di';
import { KafkaPluginOptions } from '../plugin';
import { Consumer, ConsumerConfig, createKafkaClient, Kafka, Producer, ProducerConfig } from '../client';
import { Logger } from '@axisparkjs/logger';

/**
 * A manager for creating and managing connections to Kafka.
 */
@Injectable()
export class KafkaConnectionManager {
    private readonly connections = new Map<string, Kafka>();
    private readonly configurations = new Map<string, { consumerConfig?: Partial<ConsumerConfig>; producerConfig?: ProducerConfig }>();
    private readonly producers = new Map<string, Producer>();
    private readonly consumers = new Map<string, Consumer>();

    constructor(
        @Inject(KAFKA_OPTIONS) private readonly kafkaPluginOptions: KafkaPluginOptions,
        @Inject(KAFKA_LOGGER) private readonly logger: Logger
    ) {}

    async createConnections(): Promise<void> {
        for (const connectionConfig of this.kafkaPluginOptions.connections) {
            const { name, config, librdkafkaConfig, autoInitialize } = connectionConfig;
            if (this.connections.has(name)) {
                throw new Error(`Connection with name '${name}' already exists. Connection names must be unique.`);
            }

            const connection = createKafkaClient(config, librdkafkaConfig);
            this.connections.set(name, connection);
            this.configurations.set(name, { ...connectionConfig });

            const initializeProducers =
                autoInitialize === undefined ||
                autoInitialize === true ||
                (typeof autoInitialize === 'object' && autoInitialize.autoInitializeProducers === true);
            const initializeConsumers =
                autoInitialize === undefined ||
                autoInitialize === true ||
                (typeof autoInitialize === 'object' && autoInitialize.autoInitializeConsumers === true);

            if (initializeProducers) await this.createProducer(name);
            if (initializeConsumers) await this.createConsumer(name);
        }
    }

    getConnection(name: string): Kafka | undefined {
        return this.connections.get(name);
    }

    getProducer(name: string): Producer | undefined {
        return this.producers.get(name);
    }

    getConsumer(name: string): Consumer | undefined {
        return this.consumers.get(name);
    }

    getAllConnections(): Map<string, Kafka> {
        return new Map(this.connections);
    }

    getAllProducers(): Map<string, Producer> {
        return new Map(this.producers);
    }

    getAllConsumers(): Map<string, Consumer> {
        return new Map(this.consumers);
    }

    async createConsumer(name: string): Promise<Consumer | undefined> {
        try {
            const connection = this.connections.get(name);
            if (!connection) return undefined;

            const { consumerConfig } = this.configurations.get(name) as any;
            const consumer = connection.consumer({ kafkaJS: { groupId: `${name.toLowerCase()}-group`, ...consumerConfig } });
            await consumer.connect();
            this.logger.info(`Consumer for connection '${name}' connected.`);
            this.consumers.set(name, consumer);
            return consumer;
        } catch (error) {
            this.logger.error(`Failed to initialize consumer for connection '${name}'`, error as Error);
        }
    }

    async createProducer(name: string): Promise<Producer | undefined> {
        try {
            const connection = this.connections.get(name);
            if (!connection) return undefined;

            const { producerConfig } = this.configurations.get(name) as any;
            const producer = connection.producer({ kafkaJS: { ...producerConfig } });
            await producer.connect();
            this.logger.info(`Producer for connection '${name}' connected.`);
            this.producers.set(name, producer);
            return producer;
        } catch (error) {
            this.logger.error(`Failed to initialize producer for connection '${name}'`, error as Error);
        }
    }

    async destroyConnections(): Promise<void> {
        for (const [name, producer] of this.producers) {
            await producer.disconnect();
            this.logger.info(`Producer for connection '${name}' disconnected.`);
        }
        this.producers.clear();

        for (const [name, consumer] of this.consumers) {
            await consumer.disconnect();
            this.logger.info(`Consumer for connection '${name}' disconnected.`);
        }
        this.consumers.clear();
        this.connections.clear();
        this.configurations.clear();
    }
}
