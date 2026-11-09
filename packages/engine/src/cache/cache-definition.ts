import type { ExecutionContext } from '../execution';

/** The transport-independent cache of a handler: the time to live of its results and an optional custom key. */
export class CacheDefinition {
    constructor(
        /** The time to live of the cached results in milliseconds. */
        public readonly ttl: number,
        /** Builds the key from the context, replacing the key of the transport resolver. */
        public readonly key?: (context: ExecutionContext) => string | undefined
    ) {}
}
