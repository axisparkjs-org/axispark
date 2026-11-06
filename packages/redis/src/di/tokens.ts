import { InjectionToken, Inject } from '@axisparkjs/di';

/** Injection token for the Redis options. */
export const REDIS_OPTIONS = new InjectionToken('REDIS_OPTIONS');
/** Injection token for the Redis logger. */
export const REDIS_LOGGER = new InjectionToken('REDIS_LOGGER');

/**
 * Creates the injection token of a named Redis connection.
 * @param name The name of the connection, as configured in the plugin options.
 * @returns The `REDIS_CONNECTION_<name>` token.
 */
export const redisConnectionToken = (name: string) => new InjectionToken(`REDIS_CONNECTION_${name}`);

/** Inject decorator for a specific Redis connection. */
export const InjectRedisConnection = (name: string) => Inject(redisConnectionToken(name));
