import type { Server } from '@modelcontextprotocol/server';

/**
 * A function that creates the protocol server that handles a connection or a request.
 */
export type McpServerProvider = () => Server;

/**
 * An interface representing an MCP transport, which receives the requests of the clients and hands them to the protocol servers.
 */
export interface McpTransport {
    /**
     * Starts receiving requests.
     */
    start(): Promise<void>;
    /**
     * Stops receiving requests and closes the open connections and sessions.
     */
    stop(): Promise<void>;
}
