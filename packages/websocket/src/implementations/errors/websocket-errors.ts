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

    /**
     * Additional fields sent to the client with the error in the acknowledgement, such as `retryAfterMs` for the rate limits.
     * @returns The additional fields, or undefined when there are none.
     */
    public get details(): Record<string, unknown> | undefined {
        return undefined;
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

/**
 * An error thrown when a client exceeds the rate limit of a WebSocket event. It is sent to the client through the acknowledgement with
 * the status `429` and the milliseconds until it can send the event again: `{ "error": "...", "status": 429, "retryAfterMs": 750 }`.
 */
export class WebSocketRateLimitExceededError extends WebSocketError {
    public constructor(
        public readonly retryAfterMs: number,
        response = 'Too many requests. Please try again later.',
        options?: { cause?: unknown; description?: string }
    ) {
        super(response, 429, options);
    }

    public override get details(): Record<string, unknown> {
        return { retryAfterMs: this.retryAfterMs };
    }
}
