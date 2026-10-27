# `@axisparkjs/rabbitmq`

[RabbitMQ](https://www.rabbitmq.com/) connections for AxiSpark.js, based on `amqp-connection-manager`.

The complete guide is in the [RabbitMQ documentation](https://axisparkjs.github.io/axispark/docs/connections/rabbitmq).

## What the package does

- Creates one or more named RabbitMQ connections with automatic reconnection and closes them when the application stops.
- Injects connections with `@InjectRabbitMQConnection()`.
- Exposes every connection through the `RabbitMQConnectionManager`.

## Install and register

```bash
npm install @axisparkjs/rabbitmq
```

```ts title="app.ts"
import { AxiSparkFactory } from '@axisparkjs/core';
import { RabbitMQPlugin, RabbitMQPluginOptionsFactory } from '@axisparkjs/rabbitmq';

const app = AxiSparkFactory.create({ name: 'Example', basePath: __dirname });

app.use(
    RabbitMQPlugin,
    RabbitMQPluginOptionsFactory.create({
        connections: [{ name: 'orders', url: 'amqp://guest:guest@localhost:5672' }]
    })
);
```

```ts title="order-publisher.ts"
import { Injectable } from '@axisparkjs/di';
import { InjectRabbitMQConnection } from '@axisparkjs/rabbitmq';
import { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';

@Injectable()
export class OrderPublisher {
    private readonly channel: ChannelWrapper;

    constructor(@InjectRabbitMQConnection('orders') connection: AmqpConnectionManager) {
        this.channel = connection.createChannel({ json: true });
    }

    async publish(orderId: string): Promise<void> {
        await this.channel.sendToQueue('orders', { orderId });
    }
}
```
