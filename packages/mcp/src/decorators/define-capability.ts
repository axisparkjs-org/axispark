import { Metadata, MetadataKey } from '@axisparkjs/common';

/**
 * Stores the metadata of a capability method in the list of its class and in the method itself.
 * @param key The metadata key of the capability.
 * @param target The class prototype.
 * @param propertyKey The method name.
 * @param metadata The metadata to store.
 */
export function defineCapability<T>(key: MetadataKey, target: object, propertyKey: string | symbol, metadata: T): void {
    const capabilities = Metadata.get<T[]>(key, target) ?? [];
    capabilities.push(metadata);

    Metadata.define(key, capabilities, target);
    Metadata.define(key, metadata, target, propertyKey);
}

/**
 * Splits the arguments of a decorator that accepts an optional name followed by options, or only the options.
 * @param nameOrOptions The name or the options.
 * @param options The options, when the first argument is the name.
 * @returns The name, if given, and the options.
 */
export function splitNameAndOptions<T extends object>(nameOrOptions?: string | T, options?: T): { name?: string; options: T } {
    if (typeof nameOrOptions === 'string') return { name: nameOrOptions, options: options ?? ({} as T) };
    return { options: nameOrOptions ?? options ?? ({} as T) };
}
