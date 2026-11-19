/**
 * Represents a WebSocket connection, including the connection details and methods to interact with it.
 */
export interface WebSocketConnection {
    /** Unique identifier for this connection. */
    id: string;
    /**
     * The address of the remote client, if the adapter knows it. Behind a proxy, it is resolved from the `X-Forwarded-For` header only
     * when the proxy is trusted with the `trustProxy` option of the plugin. Unlike `id`, it does not change when the client reconnects.
     */
    readonly remoteAddress: string | undefined;
    /** Namespace this connection belongs to, if the adapter supports namespaces. */
    namespace: string | undefined;
    /** Rooms/channels this connection currently belongs to, if the adapter supports them. */
    rooms: readonly string[];

    /** Sends an event with a payload to this connection only. */
    emit<TData = unknown>(event: string, data?: TData): void;

    /** Joins a room/channel, if supported by the underlying adapter. */
    join(room: string): void;

    /** Leaves a room/channel, if supported by the underlying adapter. */
    leave(room: string): void;

    /** Broadcasts an event to a room (excluding or including self, per adapter convention). */
    broadcast<TData = unknown>(room: string, event: string, data?: TData): void;

    /** Closes the connection, optionally with a reason code/message. */
    close(code?: number, reason?: string): void;

    /** Whether the underlying transport connection is still open. */
    readonly connected: boolean;

    /**
     * Optional signal aborted with a `ClientDisconnectedError` when the connection is closed. The engine combines it with the signal of the execution (`@Signal()`), so the handlers of the events stop when the client disconnects. Adapters without it only abort the execution on timeouts.
     */
    readonly signal?: AbortSignal;
}
