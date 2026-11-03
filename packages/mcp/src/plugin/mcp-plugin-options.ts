import { PluginOptions } from '@axisparkjs/core';

/**
 * The transports supported by the MCP plugin: `stdio` for clients that launch the application as a subprocess, and `http` for Streamable HTTP.
 */
export type McpTransportType = 'stdio' | 'http';

/**
 * Options for configuring the MCP plugin.
 */
export interface McpPluginOptions extends PluginOptions {
    /**
     * The name of the server sent to the clients. Defaults to the application name.
     */
    name?: string;
    /**
     * The version of the server sent to the clients. Defaults to the version in the `package.json` of the application.
     */
    version?: string;
    /**
     * Instructions that describe how to use the server, which clients can add to the context of the model.
     */
    instructions?: string;
    /**
     * The transport used to communicate with the clients.
     */
    transport: McpTransportType;
    /**
     * The path of the endpoint for the HTTP transport. When the endpoint is mounted on the HTTP plugin server, the base path of the HTTP plugin is prepended. Defaults to `/mcp`.
     */
    path?: string;
    /**
     * Whether to mount the HTTP endpoint on the HTTP plugin server instead of opening its own port. It requires the HTTP plugin.
     */
    useHttpPluginServer?: boolean;
    /**
     * The port of the standalone HTTP server, used when `useHttpPluginServer` is false. Defaults to 3000.
     */
    port?: number;
    /**
     * The host names accepted in the `Host` header by the HTTP transport, such as `['localhost', '127.0.0.1']`. Set it to protect local servers against DNS rebinding attacks. All hosts are accepted when it is not set.
     */
    allowedHosts?: string[];
    /**
     * The host names accepted in the `Origin` header by the HTTP transport. All origins are accepted when it is not set.
     */
    allowedOrigins?: string[];
    /**
     * A default timeout in milliseconds for every tool, resource and prompt. Handlers can override it with `@Timeout()`.
     */
    timeout?: number;
}
