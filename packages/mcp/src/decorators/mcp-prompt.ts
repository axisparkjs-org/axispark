import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { McpPromptMetadata, McpPromptOptions } from '../metadata';
import { defineCapability, splitNameAndOptions } from './define-capability';

/**
 * A method decorator that exposes a method as an MCP prompt. The prompt arguments are received with `@McpArgs()`.
 * @param name The name of the prompt. Defaults to the method name.
 * @param options The options of the prompt.
 * @returns A method decorator.
 */
export function McpPrompt(name?: string, options?: McpPromptOptions): MethodDecorator;
/**
 * A method decorator that exposes a method as an MCP prompt named after the method.
 * @param options The options of the prompt.
 * @returns A method decorator.
 */
export function McpPrompt(options: McpPromptOptions): MethodDecorator;
export function McpPrompt(nameOrOptions?: string | McpPromptOptions, promptOptions?: McpPromptOptions): MethodDecorator {
    const { name, options } = splitNameAndOptions(nameOrOptions, promptOptions);
    return (target, propertyKey) => {
        const metadata: McpPromptMetadata = {
            ...options,
            target: Metadata.normalizeTarget(target),
            propertyKey,
            name: name ?? String(propertyKey)
        };
        defineCapability(MetadataKeys.MCP_PROMPT, target, propertyKey, metadata);
    };
}
