import { LogEntry } from '../log-entry';
import { LogFormatter } from '../log-formatter';
import { LogLevel } from '../log-level';

/**
 * A log formatter that outputs log entries in a simple, compact format.
 */
export class SimpleFormatter implements LogFormatter {
    format(entry: LogEntry): string {
        const scope = entry.scopes.length ? `[${entry.scopes.join(' > ')}] ` : '';

        const metadata = entry.metadata && Object.keys(entry.metadata).length > 0 ? ` ${JSON.stringify(entry.metadata)}` : '';

        const error = entry.error ? `\n${entry.error.stack ?? entry.error.message}` : '';

        return `[${entry.timestamp.toISOString()}] ${LogLevel[entry.level].toUpperCase()} ${scope}${entry.message}${metadata}${error}`;
    }
}
