import { Parameter } from '@axisparkjs/engine';
import { McpParameter } from './mcp-parameter';

/**
 * Information about the MCP session or connection that carries a request.
 */
export interface McpSession {
    /** The session identifier assigned by the transport, if the transport uses sessions. */
    id: string | undefined;
    /** The transport that received the request. */
    transport: 'stdio' | 'http';
    /** The validated authentication information of the request, when the HTTP transport provides it. */
    authInfo?: Readonly<Record<string, unknown>>;
    /** The headers of the HTTP request. Only set for the HTTP transport. */
    headers?: Readonly<Record<string, string>>;
}

/**
 * A parameter decorator for injecting the {@link McpSession} of the current request.
 * @returns A parameter decorator.
 */
export const McpSession = () => Parameter(McpParameter.Session);
