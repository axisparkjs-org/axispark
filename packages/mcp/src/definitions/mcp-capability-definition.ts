import { McpPromptDefinition } from './mcp-prompt-definition';
import { McpResourceDefinition } from './mcp-resource-definition';
import { McpToolDefinition } from './mcp-tool-definition';

/**
 * The definition of any MCP capability: a tool, a resource or a prompt.
 */
export type McpCapabilityDefinition = McpToolDefinition | McpResourceDefinition | McpPromptDefinition;

/**
 * The MCP capabilities generated from the classes decorated with `@McpServer`.
 */
export interface McpDefinitions {
    tools: McpToolDefinition[];
    resources: McpResourceDefinition[];
    prompts: McpPromptDefinition[];
}
