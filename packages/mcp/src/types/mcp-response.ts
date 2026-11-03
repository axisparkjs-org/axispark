import { McpError } from '../implementations/errors/mcp-error';

/**
 * The outcome of an MCP request after it has run through the execution engine. It holds either the MCP result sent to the client or the error returned as a protocol error.
 */
export type McpResponse = { result: Record<string, unknown>; error?: undefined } | { result?: undefined; error: McpError };
