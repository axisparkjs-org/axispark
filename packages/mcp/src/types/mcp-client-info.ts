/**
 * Information about the MCP client that sent a request, as declared by the client itself.
 */
export interface McpClientInfo {
    /** The name of the client application. */
    name: string;
    /** The version of the client application. */
    version: string;
    /** A human-readable title of the client application, if the client declares one. */
    title?: string;
}
