/**
 * Error thrown when a store provider is asked for a kind of store that it does not implement.
 */
export class StoreKindNotSupportedError extends Error {
    /**
     * Creates a new instance of the `StoreKindNotSupportedError` class.
     * @param provider The name of the provider, such as `MemoryStore`.
     * @param kind The kind of store that was requested.
     */
    constructor(provider: string, kind: string) {
        super(`${provider} does not support '${kind}' stores.`);
        this.name = 'StoreKindNotSupportedError';
    }
}
