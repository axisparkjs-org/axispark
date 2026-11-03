/**
 * An enumeration representing the transport mechanisms for execution contexts. The `All` value indicates that the execution context can be transported using any mechanism, while `Http` specifies that the context is transported via HTTP, `WebSocket` via WebSockets, `Mcp` via the Model Context Protocol, and `Other` represents any other transport mechanism not explicitly defined.
 */
export enum ExecutionTransport {
    All = 'all',
    Http = 'http',
    WebSocket = 'websocket',
    Mcp = 'mcp',
    Other = 'other'
}
