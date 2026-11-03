/**
 * The JSON-RPC error codes used by MCP errors.
 */
export enum McpErrorCode {
    InvalidRequest = -32600,
    MethodNotFound = -32601,
    InvalidParams = -32602,
    InternalError = -32603
}

/**
 * A base class for MCP errors. A tool that throws it returns a tool result with `isError: true`; a resource or a prompt returns a JSON-RPC error with its `code`.
 */
export class McpError extends Error {
    public constructor(
        message: string,
        public readonly code: number = McpErrorCode.InternalError,
        public readonly options?: { cause?: unknown; data?: unknown }
    ) {
        super(message, options?.cause === undefined ? undefined : { cause: options.cause });
        this.name = this.constructor.name;
    }
}
