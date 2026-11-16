import { Logger } from '@axisparkjs/logger';
import { Timeout, Scheduler } from '@axisparkjs/schedule';
import { Consumer, InjectKafkaConnection, InjectKafkaConsumer, InjectKafkaProducer, Kafka, KafkaConnectionManager, kafkaConnectionToken, Producer } from '@axisparkjs/kafka';
import { Inject } from '@axisparkjs/di';

@Scheduler()
export class UsingKafkaExample {
    constructor(
        private readonly logger: Logger,
        @InjectKafkaConnection('1') private readonly kafkaConnection1: Kafka,
        @Inject(kafkaConnectionToken('2')) private readonly kafkaConnection2: Kafka,
        @InjectKafkaConnection('3') private readonly kafkaConnection3: Kafka,
        @InjectKafkaConnection('4') private readonly kafkaConnection4: Kafka,
        private readonly kafkaConnectionMaganer: KafkaConnectionManager,

        @InjectKafkaConsumer('1') private readonly kafkaConsumer1: Consumer,
        @InjectKafkaConsumer('2') private readonly kafkaConsumer2: Consumer,
        @InjectKafkaConsumer('3') private readonly kafkaConsumer3: Consumer,
        @InjectKafkaConsumer('4') private readonly kafkaConsumer4: Consumer,
        @InjectKafkaProducer('1') private readonly kafkaProducer1: Producer,
        @InjectKafkaProducer('2') private readonly kafkaProducer2: Producer,
        @InjectKafkaProducer('3') private readonly kafkaProducer3: Producer,
        @InjectKafkaProducer('4') private readonly kafkaProducer4: Producer
    ) {}

    @Timeout(500)
    async everySecondJob() {
        await this.logger.info(`Kafka Connection 1 defined: ${this.kafkaConnection1 !== undefined}`);
        await this.logger.info(`Kafka Connection 2 defined: ${this.kafkaConnection2 !== undefined}`);
        await this.logger.info(`Kafka Connection 3 defined: ${this.kafkaConnection3 !== undefined}`);
        await this.logger.info(`Kafka Connection 4 defined: ${this.kafkaConnection4 !== undefined}`);
        await this.logger.info(`Kafka Consumer 1 defined: ${this.kafkaConsumer1 !== undefined}`);
        await this.logger.info(`Kafka Consumer 2 defined: ${this.kafkaConsumer2 !== undefined}`);
        await this.logger.info(`Kafka Consumer 3 defined: ${this.kafkaConsumer3 !== undefined}`);
        await this.logger.info(`Kafka Consumer 4 defined: ${this.kafkaConsumer4 !== undefined}`);
        await this.logger.info(`Kafka Producer 1 defined: ${this.kafkaProducer1 !== undefined}`);
        await this.logger.info(`Kafka Producer 2 defined: ${this.kafkaProducer2 !== undefined}`);
        await this.logger.info(`Kafka Producer 3 defined: ${this.kafkaProducer3 !== undefined}`);
        await this.logger.info(`Kafka Producer 4 defined: ${this.kafkaProducer4 !== undefined}`);
        await this.logger.info(`Kafka Connection Manager has ${this.kafkaConnectionMaganer.getAllConnections().size} connections`);
        await this.logger.info(`Kafka Connection Manager has connections: ${Array.from(this.kafkaConnectionMaganer.getAllConnections().keys()).join(', ')}`);
        await this.logger.info(`Connection 1 compared to Manager: ${this.kafkaConnection1 === this.kafkaConnectionMaganer.getConnection('1')}`);
        await this.logger.info(`Consumer 1 compared to Manager: ${this.kafkaConsumer1 === this.kafkaConnectionMaganer.getConsumer('1')}`);
        await this.logger.info(`Producer 1 compared to Manager: ${this.kafkaProducer1 === this.kafkaConnectionMaganer.getProducer('1')}`);
    }
}
