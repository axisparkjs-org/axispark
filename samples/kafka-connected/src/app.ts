import { AxiSparkFactory } from '@axisparkjs/core';
import { ConsoleTransport, LogLevel, SimpleFormatter } from '@axisparkjs/logger';
import { KafkaPlugin, KafkaPluginOptionsFactory } from '@axisparkjs/kafka';
import { SchedulePlugin } from '@axisparkjs/schedule';

export const app = AxiSparkFactory.create({
    name: 'Kafka Connected App',
    basePath: __dirname,
    logTransports: [
        new ConsoleTransport({
            minLevel: LogLevel.Trace,
            formatter: new SimpleFormatter()
        })
    ]
});
// The Kafka plugin is registered first: it connects the clients during its registration, and the timeout job of the
// scheduler is counted from the registration of the scheduler plugin.
app.use(
    KafkaPlugin,
    KafkaPluginOptionsFactory.create({
        connections: [
            {
                name: '1',
                config: {
                    brokers: ['localhost:9092'],
                    logLevel: 0
                }
            },
            {
                name: '2',
                config: {
                    brokers: ['localhost:9092'],
                    logLevel: 0
                },
                autoInitialize: false
            },
            {
                name: '3',
                config: {
                    brokers: ['localhost:9092'],
                    logLevel: 0
                },
                autoInitialize: {
                    autoInitializeConsumers: false,
                    autoInitializeProducers: true
                }
            },
            {
                name: '4',
                config: {
                    brokers: ['localhost:9093'],
                    logLevel: 0,
                    retry: { retries: 0 },
                    // The unreachable broker fails each connection attempt after the setup timeout of the client
                    // (connectionTimeout + authenticationTimeout).
                    connectionTimeout: 500,
                    authenticationTimeout: 500
                }
            }
        ]
    })
);
app.use(SchedulePlugin);
