import { ClassType } from '@axisparkjs/common';
import { McpPromptArgument } from '../metadata';
import { McpHandler } from './mcp-handler';

/**
 * A class representing the definition of an MCP prompt.
 */
export class McpPromptDefinition {
    /** The arguments accepted by the prompt. */
    public readonly arguments: McpPromptArgument[];

    constructor(
        public readonly target: ClassType,
        public readonly propertyKey: string | symbol,
        public readonly name: string,
        public readonly description: string | undefined,
        public readonly title: string | undefined,
        promptArguments: McpPromptArgument[],
        public readonly handler: McpHandler
    ) {
        this.arguments = promptArguments;
    }
}
