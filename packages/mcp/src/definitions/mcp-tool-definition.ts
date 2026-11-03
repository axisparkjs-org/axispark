import { ClassType } from '@axisparkjs/common';
import { McpToolAnnotations } from '../metadata';
import { JsonSchema } from '../schema';
import { McpHandler } from './mcp-handler';

/**
 * A class representing the definition of an MCP tool.
 */
export class McpToolDefinition {
    constructor(
        public readonly target: ClassType,
        public readonly propertyKey: string | symbol,
        public readonly name: string,
        public readonly description: string | undefined,
        public readonly title: string | undefined,
        public readonly inputSchema: JsonSchema,
        public readonly annotations: McpToolAnnotations | undefined,
        public readonly handler: McpHandler
    ) {}
}
