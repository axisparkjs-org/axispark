import { InjectionToken, Inject, createTokenFactory } from '@axisparkjs/di';

/** Injection token for the RabbitMQ options. */
export const RABBITMQ_OPTIONS = new InjectionToken('RABBITMQ_OPTIONS');
/** Injection token for the RabbitMQ logger. */
export const RABBITMQ_LOGGER = new InjectionToken('RABBITMQ_LOGGER');

/** Returns the injection token of a named RabbitMQ connection, the same instance for the same name. */
export const rabbitMQConnectionToken = createTokenFactory((name: string) => `RABBITMQ_CONNECTION_${name}`);

/** Inject decorator for a specific RabbitMQ connection. */
export const InjectRabbitMQConnection = (name: string) => Inject(rabbitMQConnectionToken(name));
