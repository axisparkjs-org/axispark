/**
 * Stores values with an optional expiration. Use a shared store, such as `RedisStore` from `@axisparkjs/redis`,
 * to share the cached values between several instances of the application.
 */
export interface CacheStore {
    /**
     * Gets the value of a key.
     * @param key The key of the value.
     * @returns The value, or `undefined` when the key does not exist or has expired.
     */
    get<T>(key: string): Promise<T | undefined>;
    /**
     * Sets the value of a key, replacing the previous one.
     * @param key The key of the value.
     * @param value The value. Shared stores serialize it, so use values that can be converted to JSON.
     * @param ttlMs The time to live of the value in milliseconds. Without it, the value does not expire.
     */
    set<T>(key: string, value: T, ttlMs?: number): Promise<void>;
    /**
     * Deletes the value of a key. Deleting a key that does not exist does nothing.
     * @param key The key of the value.
     */
    delete(key: string): Promise<void>;
}
