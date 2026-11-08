import { PluginOptions } from '@axisparkjs/core';
import { TrustProxyOption } from '@axisparkjs/http';
import { StoreProvider } from '@axisparkjs/store';
import { WebSocketAdapterClass } from '../adapter/websocket-adapter';
import { WebSocketContext } from '../types/websocket-context';

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

/**
 * How the rate limits identify the clients of the WebSocket events: by `'address'` (the remote address of the connection), by
 * `'connection'` (the connection id), or with a function, for example to count the events per authenticated user.
 */
export type WebSocketRateLimitBy = 'address' | 'connection' | ((context: WebSocketContext) => string | Promise<string>);

/**
 * Options for configuring the rate limits of the WebSocket events.
 */
export interface WebSocketRateLimitOptions {
    /** The sliding time window in milliseconds. Defaults to 60000. */
    ttl?: number;
    /** The maximum number of events allowed in the window, per client and event handler. Defaults to 100. */
    limit?: number;
    /** The error message when a client exceeds the limit. The function receives the milliseconds until it can send the event again. */
    message?: string | ((retryAfterMs: number) => string);
    /** How the clients are identified. Defaults to `'address'`, falling back to the connection id when the adapter does not know the address. */
    by?: WebSocketRateLimitBy;
    /**
     * The provider of the store that counts the events, called when the plugin starts. Defaults to `MemoryStore()`, which keeps the counters
     * in the process. Use a shared provider, such as `RedisStore('NAME')` from `@axisparkjs/redis`, to share the limits between instances.
     */
    store?: StoreProvider<'rate-limit'>;
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
    /**
     * Whether to apply rate limits to the WebSocket events. Defaults to false. `@RateLimit()` and `@NoRateLimit()` override the default
     * limits on a class or event.
     */
    rateLimit?: boolean;
    /**
     * The default rate limits of the WebSocket events and their store.
     */
    rateLimitOptions?: WebSocketRateLimitOptions;
}
