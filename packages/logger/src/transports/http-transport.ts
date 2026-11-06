import { LogEntry } from '../log-entry';
import { LogTransport, LogTransportOptions } from '../log-transport';

/**
 * Options for configuring an HTTP log transport.
 */
export interface HttpTransportOptions extends LogTransportOptions {
    /** The URL to which log entries will be sent via HTTP POST requests. */
    url: string;
    /** Optional headers to include in the HTTP requests. */
    headers?: Record<string, string>;
}

/** The JSON representation of an error sent by the {@link HttpTransport}. */
interface SerializedError {
    name: string;
    message: string;
    stack?: string;
    cause?: unknown;
}

/** The maximum depth of the error causes that are serialized, to avoid infinite loops with circular causes. */
const MAX_CAUSE_DEPTH = 10;

/**
 * Serializes an error with its `name`, `message`, `stack` and `cause`, which are not enumerable and would be lost by `JSON.stringify`.
 * @param error The error to serialize.
 * @param depth The depth of the error in the chain of causes.
 * @returns The serialized error.
 */
function serializeError(error: Error, depth = 0): SerializedError {
    const serialized: SerializedError = { name: error.name, message: error.message, stack: error.stack };
    if (error.cause !== undefined && depth < MAX_CAUSE_DEPTH) {
        serialized.cause = error.cause instanceof Error ? serializeError(error.cause, depth + 1) : error.cause;
    }
    return serialized;
}

/**
 * A log transport that outputs log entries via HTTP POST requests.
 * The entry is sent as JSON, and its error is sent with its `name`, `message`, `stack` and `cause`.
 */
export class HttpTransport extends LogTransport {
    constructor(private readonly options: HttpTransportOptions) {
        super(options);
    }

    async write(entry: LogEntry): Promise<void> {
        if (entry.level < this.options.minLevel) return;

        await fetch(this.options.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...this.options.headers
            },
            body: JSON.stringify(entry.error ? { ...entry, error: serializeError(entry.error) } : entry)
        });
    }
}
