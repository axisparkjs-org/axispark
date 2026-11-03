import { McpCapability } from './mcp-capability';

/**
 * Represents a single MCP request handled by a tool, a resource or a prompt.
 */
export interface McpRequest {
    /** The kind of capability the request is addressed to. */
    capability: McpCapability;
    /** The name of the tool, resource or prompt, including the prefix of its `@McpServer`. */
    name: string;
    /** The URI requested by the client. Only set for resources. */
    uri?: string;
    /** The arguments sent by the client. Set for tools and prompts; an empty object for resources. */
    arguments: Record<string, unknown>;
    /** The variables extracted from the URI template of a resource. An empty object for tools and prompts. */
    params: Record<string, string | string[]>;
    /** The `_meta` object sent with the request, if any. */
    meta?: Record<string, unknown>;
    /** A signal that is aborted when the client cancels the request or the transport is closed. */
    signal?: AbortSignal;
}
