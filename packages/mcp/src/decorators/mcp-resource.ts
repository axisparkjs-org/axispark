import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { McpResourceMetadata, McpResourceOptions } from '../metadata';
import { defineCapability } from './define-capability';

/**
 * A method decorator that exposes a method as an MCP resource. The URI can be a fixed URI (`config://app`) or a URI template (`users://{id}`); the variables of a template are received with `@McpParam(name)`.
 * @param uri The URI or URI template of the resource.
 * @param options The options of the resource.
 * @returns A method decorator.
 */
export function McpResource(uri: string, options: McpResourceOptions = {}): MethodDecorator {
    return (target, propertyKey) => {
        const metadata: McpResourceMetadata = {
            ...options,
            target: Metadata.normalizeTarget(target),
            propertyKey,
            uri,
            name: options.name ?? String(propertyKey)
        };
        defineCapability(MetadataKeys.MCP_RESOURCE, target, propertyKey, metadata);
    };
}
