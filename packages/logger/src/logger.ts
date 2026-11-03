import { Injectable } from '@axisparkjs/di';
import { LogData, LogMetadata } from './log-data';
import { LogEntry } from './log-entry';
import { LogLevel } from './log-level';
import { LogTransport } from './log-transport';

/**
 * A class for handling logging operations with support for multiple transports and scoping.
 */
@Injectable()
export class Logger {
    /**
     * Constructor for the Logger class.
     * @param transports An array of LogTransport instances that define how log entries are handled (e.g., written to console, file, etc.).
     * @param scopes An optional array of strings representing the scopes or contexts for the logger, allowing for hierarchical logging.
     * @param metadata Optional metadata merged into every entry written by this logger.
     */
    constructor(
        private readonly transports: LogTransport[],
        private readonly scopes: string[] = [],
        private readonly metadata?: LogMetadata
    ) {}

    /**
     * Logs an info message.
     * @param message Message of the entry.
     * @param metadata Optional structured data of the entry, such as `{ method: 'GET', status: 200 }`.
     */
    async info(message: string, metadata?: LogMetadata) {
        await this.log({ level: LogLevel.Info, message, metadata });
    }

    /**
     * Logs a warning message.
     * @param message Message of the entry.
     * @param metadata Optional structured data of the entry.
     */
    async warn(message: string, metadata?: LogMetadata) {
        await this.log({ level: LogLevel.Warn, message, metadata });
    }

    /**
     * Logs an error message.
     * @param message Message of the entry.
     * @param error Optional error that caused the entry.
     * @param metadata Optional structured data of the entry.
     */
    async error(message: string, error?: Error, metadata?: LogMetadata) {
        await this.log({ level: LogLevel.Error, message, error, metadata });
    }

    /**
     * Logs a debug message.
     * @param message Message of the entry.
     * @param metadata Optional structured data of the entry.
     */
    async debug(message: string, metadata?: LogMetadata) {
        await this.log({ level: LogLevel.Debug, message, metadata });
    }

    /**
     * Logs a trace message.
     * @param message Message of the entry.
     * @param metadata Optional structured data of the entry.
     */
    async trace(message: string, metadata?: LogMetadata) {
        await this.log({ level: LogLevel.Trace, message, metadata });
    }

    /**
     * Logs a fatal message.
     * @param message Message of the entry.
     * @param error Optional error that caused the entry.
     * @param metadata Optional structured data of the entry.
     */
    async fatal(message: string, error?: Error, metadata?: LogMetadata) {
        await this.log({ level: LogLevel.Fatal, message, error, metadata });
    }

    /**
     * Creates a child logger with an additional scope.
     * @param scope Scope added to the scopes of this logger.
     * @param metadata Optional metadata merged into every entry of the child logger, after the metadata of this logger.
     * Metadata passed to a level method overrides the bound values with the same key.
     */
    public child(scope: string, metadata?: LogMetadata): Logger {
        return new Logger(this.transports, [...this.scopes, scope], this.mergeMetadata(this.metadata, metadata));
    }

    /** Internal method to log data using the configured transports. */
    public async log(data: LogData) {
        const entry: LogEntry = {
            timestamp: new Date(),
            level: data.level,
            message: data.message,
            scopes: this.scopes,
            error: data.error,
            metadata: this.mergeMetadata(this.metadata, data.metadata)
        };

        await Promise.all(this.transports.map((t) => t.write(entry)));
    }

    private mergeMetadata(bound?: LogMetadata, metadata?: LogMetadata): LogMetadata | undefined {
        if (!bound) return metadata;
        if (!metadata) return bound;
        return { ...bound, ...metadata };
    }
}
