import { LogLevel } from './log-level';

/** Structured data attached to a log entry, such as `{ orderId: '42', durationMs: 12 }`. */
export type LogMetadata = Record<string, unknown>;

/**
 * Defines the structure of log data, including its level, message, optional error, and optional metadata.
 */
export interface LogData {
    level: LogLevel;
    message: string;
    error?: Error;
    metadata?: LogMetadata;
}
