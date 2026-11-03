import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { McpToolMetadata, McpToolOptions } from '../metadata';
import { defineCapability, splitNameAndOptions } from './define-capability';

/**
 * A method decorator that exposes a method as an MCP tool. The tool input is received with `@McpArgs()`, and its JSON Schema is generated from the `class-validator` class of that parameter.
 * @param name The name of the tool. Defaults to the method name.
 * @param options The options of the tool.
 * @returns A method decorator.
 */
export function McpTool(name?: string, options?: McpToolOptions): MethodDecorator;
/**
 * A method decorator that exposes a method as an MCP tool named after the method.
 * @param options The options of the tool.
 * @returns A method decorator.
 */
export function McpTool(options: McpToolOptions): MethodDecorator;
export function McpTool(nameOrOptions?: string | McpToolOptions, toolOptions?: McpToolOptions): MethodDecorator {
    const { name, options } = splitNameAndOptions(nameOrOptions, toolOptions);
    return (target, propertyKey) => {
        const metadata: McpToolMetadata = {
            ...options,
            target: Metadata.normalizeTarget(target),
            propertyKey,
            name: name ?? String(propertyKey)
        };
        defineCapability(MetadataKeys.MCP_TOOL, target, propertyKey, metadata);
    };
}
