# `@axisparkjs/kafka`

Kafka connections for AxiSpark.js, built on the KafkaJS-compatible API of [`@confluentinc/kafka-javascript`](https://github.com/confluentinc/confluent-kafka-javascript), the client maintained by Confluent on top of librdkafka.

The complete guide is in the [Kafka documentation](https://axisparkjs.com/docs/connections/kafka).

## What the package does

- Creates one or more named Kafka clients and disconnects them when the application stops.
- Creates and connects a producer and a consumer for each connection, eagerly or lazily (`autoInitialize`).
- Injects clients, producers and consumers with `@InjectKafkaConnection()`, `@InjectKafkaProducer()` and `@InjectKafkaConsumer()`.
- Exposes every connection through the `KafkaConnectionManager`.

## Install and register

```bash
npm install @axisparkjs/kafka
```

```ts title="app.ts"
import { AxiSparkFactory } from '@axisparkjs/core';
import { KafkaPlugin, KafkaPluginOptionsFactory } from '@axisparkjs/kafka';

const app = AxiSparkFactory.create({ name: 'Example', basePath: __dirname });

app.use(
    KafkaPlugin,
    KafkaPluginOptionsFactory.create({
        connections: [{ name: 'orders', config: { brokers: ['localhost:9092'] } }]
    })
);
```

```ts title="order-publisher.ts"
import { Injectable } from '@axisparkjs/di';
import { InjectKafkaProducer, Producer } from '@axisparkjs/kafka';

@Injectable()
export class OrderPublisher {
    constructor(@InjectKafkaProducer('orders') private readonly producer: Producer) {}

    async publish(orderId: string): Promise<void> {
        await this.producer.send({ topic: 'orders', messages: [{ value: orderId }] });
    }
}
```
