import { RedisClientType } from 'redis';
import { RedisStoreConnectionNotReadyError } from './redis-store-errors';

/**
 * The Redis connection used by the stores of a `RedisStore`, with the prefix of their keys.
 * The connection is created and closed by the `RedisPlugin`: the stores never open or close it.
 */
export class RedisStoreConnection {
    /**
     * @param name The name of the connection, used in the error messages.
     * @param client The client of the connection.
     * @param prefix The prefix added to every key of the store.
     */
    constructor(
        public readonly name: string,
        private readonly client: RedisClientType,
        public readonly prefix: string
    ) {}

    /** Adds the prefix of the store to a key. */
    public key(key: string): string {
        return `${this.prefix}${key}`;
    }

    /**
     * Returns the client when it is ready. The operations are rejected while the client reconnects, because node-redis would queue them
     * until the connection is available again and the callers, such as HTTP requests, would wait indefinitely.
     * @throws {RedisStoreConnectionNotReadyError} When the client is not ready.
     */
    public ready(): RedisClientType {
        if (!this.client.isReady) throw new RedisStoreConnectionNotReadyError(this.name);
        return this.client;
    }
}

/** Converts a time to live to the positive integer of milliseconds accepted by Redis. */
export const toRedisTtl = (ttlMs: number): number => Math.max(1, Math.ceil(ttlMs));
