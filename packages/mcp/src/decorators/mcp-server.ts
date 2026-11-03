import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { Constructable } from '@axisparkjs/di';
import { McpServerMetadata } from '../metadata';

/**
 * Options of the `@McpServer` decorator.
 */
export interface McpServerOptions {
    /**
     * A namespace for the tools, prompts and resource names of the class. With `prefix: 'users'`, the tool `search` is published as `users.search`.
     */
    prefix?: string;
}

/**
 * A class decorator that marks a class as a group of MCP capabilities: tools, resources and prompts. The class is resolved through the dependency injection container.
 * @param options The options of the group.
 * @returns A class decorator.
 */
export function McpServer(options: McpServerOptions = {}): ClassDecorator {
    return (target) => {
        const metadata: McpServerMetadata = {
            target: Metadata.normalizeTarget(target),
            prefix: options.prefix
        };
        Constructable(MetadataKeys.INJECTABLE)(target);
        Metadata.define(MetadataKeys.MCP_SERVER, metadata, target);
    };
}
