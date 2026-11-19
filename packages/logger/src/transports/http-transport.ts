import { LogEntry } from '../log-entry';
import { LogTransport, LogTransportOptions } from '../log-transport';

const DEFAULT_TIMEOUT = 5000;
const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_BATCH_INTERVAL = 1000;
/** The minimum time between two reports of failed batches on `process.stderr`. */
const BATCH_ERROR_REPORT_INTERVAL = 60_000;

/**
 * Options for sending the entries of an HTTP log transport in batches.
 */
export interface HttpTransportBatchOptions {
    /** The number of entries that sends a batch at once. Defaults to 100. */
    size?: number;
    /** The maximum time, in milliseconds, that an entry waits for its batch to be sent. Defaults to 1000. */
    interval?: number;
}

/**
 * Options for configuring an HTTP log transport.
 */
export interface HttpTransportOptions extends LogTransportOptions {
    /** The URL to which log entries will be sent via HTTP POST requests. */
    url: string;
    /** The maximum time, in milliseconds, to wait for the endpoint before the entry is dropped as a failure. Defaults to 5000. */
    timeout?: number;
    /** Optional headers to include in the HTTP requests. */
    headers?: Record<string, string>;
    /**
     * Sends the entries in batches, as a JSON array, instead of one request per entry. A batch is sent when it has `size` entries or after
     * `interval` milliseconds, and the pending entries are sent by `flush()` (called when the application is destroyed). The call to the
     * logger does not wait for the request, so the failures of a batch are reported to `onError` for each entry, or once a minute on
     * `process.stderr`, and `failOnError` does not apply. `true` uses the default size and interval.
     */
    batch?: boolean | HttpTransportBatchOptions;
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
 * The entry is sent as JSON, and its error is sent with its `name`, `message`, `stack` and `cause`. With the `batch` option, the entries are
 * sent together as a JSON array.
 */
export class HttpTransport extends LogTransport {
    private pending: LogEntry[] = [];
    private timer?: ReturnType<typeof setTimeout>;
    private readonly sending = new Set<Promise<void>>();
    private lastBatchReport?: number;

    constructor(private readonly options: HttpTransportOptions) {
        super(options);
    }

    async write(entry: LogEntry): Promise<void> {
        if (entry.level < this.options.minLevel) return;

        const batch = this.batchOptions();
        if (!batch) {
            await this.send(entry);
            return;
        }

        this.pending.push(entry);
        if (this.pending.length >= batch.size) this.sendBatch();
        else this.timer ??= setTimeout(() => this.sendBatch(), batch.interval).unref();
    }

    /** Sends the pending batch, if any, and waits for the batches that are being sent. */
    override async flush(): Promise<void> {
        this.sendBatch();
        await Promise.allSettled([...this.sending]);
    }

    private batchOptions(): Required<HttpTransportBatchOptions> | undefined {
        const { batch } = this.options;
        if (!batch) return undefined;
        const options = batch === true ? {} : batch;
        return { size: Math.max(1, options.size ?? DEFAULT_BATCH_SIZE), interval: options.interval ?? DEFAULT_BATCH_INTERVAL };
    }

    private sendBatch(): void {
        clearTimeout(this.timer);
        this.timer = undefined;
        if (this.pending.length === 0) return;

        const entries = this.pending;
        this.pending = [];
        const sending = this.send(entries).catch((error) => this.reportBatchError(error, entries));
        this.sending.add(sending);
        void sending.finally(() => this.sending.delete(sending));
    }

    private async send(body: LogEntry | LogEntry[]): Promise<void> {
        await fetch(this.options.url, {
            method: 'POST',
            signal: AbortSignal.timeout(this.options.timeout ?? DEFAULT_TIMEOUT),
            headers: {
                'Content-Type': 'application/json',
                ...this.options.headers
            },
            body: JSON.stringify(Array.isArray(body) ? body.map(serializeEntry) : serializeEntry(body))
        });
    }

    /* The Logger does not wait for the batches, so their failures are reported here, like the Logger reports the failures of the entries. */
    private reportBatchError(reason: unknown, entries: LogEntry[]): void {
        const error = reason instanceof Error ? reason : new Error(String(reason));
        const { onError } = this.options;
        if (onError) {
            for (const entry of entries) {
                try {
                    onError(error, entry);
                } catch {
                    // A failing callback must not stop the report of the other entries.
                }
            }
            return;
        }

        const now = Date.now();
        if (this.lastBatchReport !== undefined && now - this.lastBatchReport < BATCH_ERROR_REPORT_INTERVAL) return;
        this.lastBatchReport = now;
        process.stderr.write(
            `[AxiSpark] The log transport HttpTransport failed to send a batch of ${entries.length} entries: ${error.name} -> ${error.message}. ` +
                `Its next failures are not reported for ${BATCH_ERROR_REPORT_INTERVAL / 1000} seconds.\n`
        );
    }
}

/* The entry as JSON, with its error serialized. */
function serializeEntry(entry: LogEntry): object {
    return entry.error ? { ...entry, error: serializeError(entry.error) } : entry;
}
