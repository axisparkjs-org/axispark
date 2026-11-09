import { Generator, Metadata, MetadataKeys } from '@axisparkjs/common';
import { Injectable } from '@axisparkjs/di';
import { ExecutionContext, ExecutionTransport } from '../execution';
import { CacheConfiguration, CacheMetadata } from '../metadata';
import { CacheDefinition } from './cache-definition';

const DEFAULT_TTL = 60_000;

/**
 * Generates the cache of a handler from its `@Cache()` and `@NoCache()` metadata and the default time to live of the transport.
 * The metadata of the method takes precedence over the metadata of its class. Without metadata, the handler is not cached.
 */
@Injectable()
export class CacheGenerator implements Generator<CacheDefinition | undefined> {
    private static readonly defaults = new Map<ExecutionTransport, number>();

    /** Registers the default time to live of the cached results of one transport. Passing undefined removes it. */
    public static registerCache(transport: ExecutionTransport, options?: Pick<CacheConfiguration, 'ttl'>): void {
        if (options?.ttl === undefined) this.defaults.delete(transport);
        else this.defaults.set(transport, options.ttl);
    }

    /**
     * Generates the cache of the handler of the context.
     * @returns The cache definition, or `undefined` when the handler is not cached.
     */
    public generate(context: ExecutionContext): CacheDefinition | undefined {
        const methodMetadata = Metadata.get<CacheMetadata>(MetadataKeys.CACHE, context.target, context.propertyKey);
        const classMetadata = Metadata.get<CacheMetadata>(MetadataKeys.CACHE, context.target);
        const metadata = methodMetadata ?? classMetadata;
        if (!metadata || metadata.disabled) return undefined;

        const ttl = metadata.options?.ttl ?? CacheGenerator.defaults.get(context.transport) ?? DEFAULT_TTL;
        return new CacheDefinition(ttl, metadata.options?.key);
    }
}
