/**
 * A lock acquired from a `LockStore`. The lock is identified by a random token, so an owner never releases or extends
 * a lock that expired and was acquired by another owner.
 */
export interface Lock {
    /** The key of the lock. */
    readonly key: string;
    /** The random token of the owner of the lock. */
    readonly token: string;
    /**
     * Releases the lock if it is still owned by this lock.
     * @returns `true` when the lock was released, or `false` when it had expired or was owned by another owner.
     */
    release(): Promise<boolean>;
    /**
     * Sets a new expiration for the lock if it is still owned by this lock.
     * @param ttlMs The new time to live of the lock in milliseconds, counted from now.
     * @returns `true` when the lock was extended, or `false` when it had expired or was owned by another owner.
     */
    extend(ttlMs: number): Promise<boolean>;
}

/**
 * Stores locks with an expiration. Use a shared store, such as `RedisStore` from `@axisparkjs/redis`, to coordinate
 * several instances of the application.
 */
export interface LockStore {
    /**
     * Acquires the lock of a key without waiting.
     * @param key The key of the lock.
     * @param ttlMs The time to live of the lock in milliseconds. The lock is released automatically when it expires.
     * @returns The lock, or `undefined` when another owner holds it.
     */
    acquire(key: string, ttlMs: number): Promise<Lock | undefined>;
}
