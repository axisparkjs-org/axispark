/**
 * Error thrown when a `RedisStore` references a connection that is not configured in the `RedisPlugin`.
 */
export class RedisStoreConnectionNotFoundError extends Error {
    /**
     * Creates a new instance of the `RedisStoreConnectionNotFoundError` class.
     * @param connection The name of the connection referenced by the store.
     */
    constructor(connection: string) {
        super(`RedisStore('${connection}') requires the RedisPlugin with a connection named '${connection}'.`);
        this.name = 'RedisStoreConnectionNotFoundError';
    }
}

/**
 * Error thrown when a Redis store receives an operation while its connection is not ready, for example while it reconnects.
 * The operation is rejected instead of being queued until the connection is ready again.
 */
export class RedisStoreConnectionNotReadyError extends Error {
    /**
     * Creates a new instance of the `RedisStoreConnectionNotReadyError` class.
     * @param connection The name of the connection used by the store.
     */
    constructor(connection: string) {
        super(`The Redis connection '${connection}' used by the store is not ready.`);
        this.name = 'RedisStoreConnectionNotReadyError';
    }
}
