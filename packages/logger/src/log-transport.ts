import { LogEntry } from './log-entry';
import { LogFormatter } from './log-formatter';
import { LogLevel } from './log-level';

/**
 * Options for configuring a log transport.
 */
export interface LogTransportOptions {
    /** The formatter to use for processing log entries. */
    formatter: LogFormatter;

    /** The minimum log level to process. */
    minLevel: LogLevel;

    /**
     * Called when the transport fails to write an entry, instead of writing the failure to `process.stderr`.
     * The `Logger` never rejects because of a transport, unless `failOnError` is enabled.
     */
    onError?: (error: Error, entry: LogEntry) => void;

    /**
     * Whether a failure of the transport rejects the call to the `Logger`, for logs that must stop the operation when they can not be written, such as audit logs.
     * The other transports still receive the entry. Defaults to `false`.
     */
    failOnError?: boolean;
}

/**
 * An abstract class for defining log transport behavior.
 */
export abstract class LogTransport {
    /** The configuration options for the log transport. */
    constructor(protected readonly config: LogTransportOptions) {}

    /** The options that decide how the failures of the transport are handled. */
    get errorOptions(): Pick<LogTransportOptions, 'onError' | 'failOnError'> {
        return { onError: this.config.onError, failOnError: this.config.failOnError };
    }

    /** The minimum level of the entries that the transport writes. The `Logger` does not build the entries below the lowest one of its transports. */
    get minLevel(): LogLevel {
        return this.config.minLevel;
    }

    /** Writes a log entry using the configured formatter and minimum level. */
    abstract write(entry: LogEntry): Promise<void>;

    /**
     * Writes the entries that the transport keeps in memory, if any, and waits for them. The transports that write each entry at once do
     * nothing. `Logger.flush()` calls it, and the application calls it when it is destroyed.
     */
    async flush(): Promise<void> {
        /* Nothing is kept in memory by default. */
    }
}
