import { HttpServer } from '@axisparkjs/common';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { hostHeaderValidation, originValidation, toNodeHandler } from '@modelcontextprotocol/node';
import { createServer, IncomingMessage, Server as NodeHttpServer, ServerResponse } from 'node:http';
import { McpServerProvider, McpTransport } from './mcp-transport';

type McpHttpHandler = ReturnType<typeof createMcpHandler>;
type RequestListener = (req: IncomingMessage, res: ServerResponse) => void;
type HeaderValidator = (req: IncomingMessage, res: ServerResponse) => boolean;

/**
 * Options of the MCP Streamable HTTP transport.
 */
export interface McpHttpTransportOptions {
    /** The path of the MCP endpoint, including the base path of the HTTP plugin when the transport is mounted on its server. */
    path: string;
    /** The port of the standalone HTTP server. Ignored when `server` is given. */
    port?: number;
    /** An existing HTTP server, such as the HTTP plugin server, where the endpoint is mounted. Other requests are passed to the listeners of that server. */
    server?: HttpServer;
    /** The host names accepted in the `Host` header. All hosts are accepted when it is not set. */
    allowedHosts?: string[];
    /** The host names accepted in the `Origin` header. All origins are accepted when it is not set. */
    allowedOrigins?: string[];
    /** A callback for errors that do not reach a handler. */
    onError?: (error: Error) => void;
}

/**
 * Normalizes a path: it adds a leading slash and removes the trailing slashes.
 * @param path The path to normalize.
 * @returns The normalized path.
 */
export function normalizeMcpPath(path: string): string {
    const normalized = `/${path}`.replace(/\/{2,}/g, '/').replace(/\/+$/, '');
    return normalized === '' ? '/' : normalized;
}

/**
 * An MCP transport that serves the Streamable HTTP protocol on a path. It opens its own HTTP server, or mounts the endpoint on an existing one.
 */
export class McpHttpTransport implements McpTransport {
    private readonly path: string;
    private readonly validators: HeaderValidator[] = [];
    private handler?: McpHttpHandler;
    private nodeHandler?: ReturnType<typeof toNodeHandler>;
    private ownServer?: NodeHttpServer;
    private originalListeners?: RequestListener[];
    private mountedListener?: RequestListener;

    constructor(
        private readonly provider: McpServerProvider,
        private readonly options: McpHttpTransportOptions
    ) {
        this.path = normalizeMcpPath(options.path);
        if (options.allowedHosts) this.validators.push(hostHeaderValidation(options.allowedHosts));
        if (options.allowedOrigins) this.validators.push(originValidation(options.allowedOrigins));
    }

    /**
     * The path of the MCP endpoint.
     */
    get endpoint(): string {
        return this.path;
    }

    async start(): Promise<void> {
        this.handler = createMcpHandler(() => this.provider(), { onerror: this.options.onError });
        this.nodeHandler = toNodeHandler(this.handler, { onerror: this.options.onError });

        if (this.options.server) {
            this.mount(this.options.server as unknown as NodeHttpServer);
            return;
        }

        const server = createServer((req, res) => {
            if (!this.handle(req, res)) {
                res.writeHead(404, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Not Found' }));
            }
        });
        await new Promise<void>((resolve, reject) => {
            server.once('error', reject);
            server.listen(this.options.port, () => resolve());
        });
        this.ownServer = server;
    }

    async stop(): Promise<void> {
        await this.handler?.close();
        this.handler = undefined;
        this.nodeHandler = undefined;

        if (this.mountedListener && this.originalListeners) {
            this.unmount(this.options.server as unknown as NodeHttpServer, this.mountedListener, this.originalListeners);
        }
        if (this.ownServer) {
            const server = this.ownServer;
            this.ownServer = undefined;
            server.closeAllConnections();
            await new Promise<void>((resolve) => server.close(() => resolve()));
        }
    }

    /**
     * Mounts the endpoint on an existing server. The `request` listeners of the server are replaced by one that serves the MCP path and passes every other request to the original listeners.
     */
    private mount(server: NodeHttpServer): void {
        const originalListeners = server.listeners('request') as RequestListener[];
        const mountedListener: RequestListener = (req, res) => {
            if (this.handle(req, res)) return;
            for (const listener of originalListeners) listener.call(server, req, res);
        };
        server.removeAllListeners('request');
        server.on('request', mountedListener);
        this.originalListeners = originalListeners;
        this.mountedListener = mountedListener;
    }

    private unmount(server: NodeHttpServer, mountedListener: RequestListener, originalListeners: RequestListener[]): void {
        server.removeListener('request', mountedListener);
        for (const listener of originalListeners) server.on('request', listener);
        this.mountedListener = undefined;
        this.originalListeners = undefined;
    }

    /**
     * Serves a request when its path is the MCP endpoint.
     * @returns True when the request was handled by the transport.
     */
    private handle(req: IncomingMessage, res: ServerResponse): boolean {
        const path = normalizeMcpPath((req.url ?? '/').split('?')[0]);
        if (path !== this.path) return false;

        if (!this.nodeHandler) {
            res.writeHead(503, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'MCP transport is not running' }));
            return true;
        }
        for (const validate of this.validators) {
            if (!validate(req, res)) return true;
        }

        void this.nodeHandler(req, res);
        return true;
    }
}
