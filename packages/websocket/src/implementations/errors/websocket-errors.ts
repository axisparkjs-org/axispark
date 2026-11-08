/**
 * A base class for WebSocket errors.
 */
export class WebSocketError extends Error {
    public constructor(
        public readonly response: string,
        public readonly status = 1,
        public readonly options?: { cause?: unknown; description?: string }
    ) {
        super(response);
        this.name = this.constructor.name;
    }
}

/**
 * An error thrown when a WebSocket event exceeds its timeout. It is sent to the client through the acknowledgement with the status `408`.
 */
export class WebSocketRequestTimeoutError extends WebSocketError {
    public constructor(response = 'Request timed out', options?: { cause?: unknown; description?: string }) {
        super(response, 408, options);
    }
}
