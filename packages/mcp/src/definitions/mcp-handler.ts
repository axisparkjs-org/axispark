import { McpContext, McpResponse } from '../types';

/**
 * A function that runs an MCP request through the execution engine and returns its response.
 * @param input The request and the session of the MCP context.
 * @returns The response of the request, or undefined when no result was processed.
 */
export type McpHandler = (input: Pick<McpContext, 'request' | 'session' | 'client'>) => Promise<McpResponse | undefined>;
