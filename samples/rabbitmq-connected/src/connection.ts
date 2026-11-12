import { Logger } from '@axisparkjs/logger';
import { Timeout, Scheduler } from '@axisparkjs/schedule';
import { AmqpConnectionManager } from 'amqp-connection-manager';
import { InjectRabbitMQConnection, RabbitMQConnectionManager, rabbitMQConnectionToken } from '@axisparkjs/rabbitmq';
import { Inject } from '@axisparkjs/di';

@Scheduler()
export class UsingRabbitMQExample {
    constructor(
        private readonly logger: Logger,
        @InjectRabbitMQConnection('1') private readonly rabbitMQConnection1: AmqpConnectionManager,
        @Inject(rabbitMQConnectionToken('2')) private readonly rabbitMQConnection2: AmqpConnectionManager,
        @InjectRabbitMQConnection('3') private readonly rabbitMQConnection3: AmqpConnectionManager,
        private readonly rabbitMQConnectionMaganer: RabbitMQConnectionManager
    ) {}

    @Timeout(500)
    async everySecondJob() {
        await this.logger.info(`RabbitMQ Connection 1 is connected: ${this.rabbitMQConnection1.isConnected()}`);
        await this.logger.info(`RabbitMQ Connection 2 is connected: ${this.rabbitMQConnection2.isConnected()}`);
        await this.logger.info(`RabbitMQ Connection 3 is connected: ${this.rabbitMQConnection3.isConnected()}`);
        await this.logger.info(`RabbitMQ Connection Manager has ${this.rabbitMQConnectionMaganer.getAllConnections().size} connections`);
        await this.logger.info(
            `RabbitMQ Connection Manager has connections: ${Array.from(this.rabbitMQConnectionMaganer.getAllConnections().keys()).join(', ')}`
        );
        await this.logger.info(`Connection 1 compared to Manager: ${this.rabbitMQConnection1 === this.rabbitMQConnectionMaganer.getConnection('1')}`);
    }
}
