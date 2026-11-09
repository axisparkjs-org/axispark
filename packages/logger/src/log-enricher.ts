import { LogMetadata } from './log-data';

/**
 * Adds context to every log entry, such as the `trace_id` and `span_id` of the active span added by `@axisparkjs/telemetry`.
 * Register it with `Logger.registerEnricher()`. It is called for every entry, so it must be fast and must not throw.
 * @returns The metadata to add to the entry, or `undefined` to add nothing. The metadata of the logger and of the entry override it.
 */
export type LogEnricher = () => LogMetadata | undefined;
