import { PluginOptions } from '@axisparkjs/core';
import { TrustProxyOption } from '@axisparkjs/http';
import { WebSocketAdapterClass } from '../adapter/websocket-adapter';

/**
 * Options for configuring the timeouts of the WebSocket events.
 */
export interface WebSocketTimeoutOptions {
    /**
     * The default timeout duration in milliseconds. Defaults to 5000 with the options factory, or to the default timeout of the engine without it.
     */
    time?: number;
    /**
     * The message sent to the client when a timeout occurs. By default, it is `Request timed out after <time>ms`.
     */
    message?: string | ((time: number) => string);
}

export interface WebSocketPluginOptions extends PluginOptions {
    /**
     * The WebSocket adapter to use. Express or Fastify are supported.
     */
    adapter: WebSocketAdapterClass;
    /**
     * The number of ms before disconnecting a client that has not successfully joined a namespace.
     */
    connectTimeout?: number;
    /**
     * It is the name of the path that is captured on the server side.
     */
    path?: string;
    /**
     * Whether to serve the client files. Default is true. If set to false, the client files will not be served.
     */
    serveClient?: boolean;
    /**
     * Whether to use the built-in HTTP server for WebSockets. Default is false. If set to true, the WebSocket server will be created using the built-in HTTP server.
     */
    useHttpPluginServer: boolean;
    /**
     * The port on which the WebSocket server will listen. Default is 3000.
     */
    port?: number;
    /**
     * Whether every WebSocket event has a default timeout. Defaults to false. The `@Timeout()` of an event works even when it is disabled, and `@NoTimeout()` disables the default timeout of an event.
     */
    timeout?: boolean;
    /**
     * Options for configuring the timeouts of the WebSocket events.
     */
    timeoutOptions?: WebSocketTimeoutOptions;
    /**
     * The proxies trusted to resolve the client address of a connection from the `X-Forwarded-For` header of its handshake, used by
     * `connection.remoteAddress` and the rate limits. It accepts the same values as the `trustProxy` option of the HTTP plugin. Defaults to
     * `false`, or to the `trustProxy` option of the HTTP plugin when `useHttpPluginServer` is enabled.
     */
    trustProxy?: TrustProxyOption;
}
