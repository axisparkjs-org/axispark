---
"@axisparkjs/cli": minor
"@axisparkjs/common": minor
"@axisparkjs/core": minor
"@axisparkjs/data": minor
"@axisparkjs/ddd": minor
"@axisparkjs/di": minor
"@axisparkjs/engine": minor
"@axisparkjs/http": minor
"@axisparkjs/http-express": minor
"@axisparkjs/http-fastify": minor
"@axisparkjs/kafka": minor
"@axisparkjs/logger": minor
"@axisparkjs/mcp": minor
"@axisparkjs/openapi": minor
"@axisparkjs/rabbitmq": minor
"@axisparkjs/redis": minor
"@axisparkjs/schedule": minor
"@axisparkjs/security": minor
"@axisparkjs/store": minor
"@axisparkjs/test": minor
"@axisparkjs/websocket": minor
"@axisparkjs/websocket-socketio": minor
---

`@axisparkjs/kafka` replaces `kafkajs`, no longer maintained, with [`@confluentinc/kafka-javascript`](https://github.com/confluentinc/confluent-kafka-javascript), the client maintained by Confluent on top of librdkafka, through its KafkaJS-compatible API. The plugin options, `KafkaConnectionManager` and the `@InjectKafkaConnection()`, `@InjectKafkaProducer()` and `@InjectKafkaConsumer()` decorators do not change: `config` is passed to the client in its `kafkaJS` block, and `producerConfig` and `consumerConfig` to the producer and the consumer. The new `librdkafkaConfig` option passes librdkafka properties to the client. The package exports the `Kafka`, `Producer`, `Consumer`, `Admin`, `KafkaConfig`, `ProducerConfig` and `ConsumerConfig` types of the new client, so applications no longer import them from `kafkajs`. The `kafka:<name>` health checks request the cluster ID, and report it as their only detail.

Breaking changes for code that uses the injected clients: import the types from `@axisparkjs/kafka` instead of `kafkajs`; set `fromBeginning`, `autoCommit` and `autoCommitInterval` in `consumerConfig` instead of `subscribe()` and `run()`; set `acks`, `compression` and `timeout` in `producerConfig` instead of `send()`; check `error.code` instead of the error name or type; `eachBatch` receives batches of one message. Connecting to an unreachable broker now fails after the connection setup timeout (`connectionTimeout` + `authenticationTimeout`) instead of immediately. The client is a native module: the package installs a pre-built binary for the platform. See the migration notes in the Kafka guide.
