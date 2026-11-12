import { LogEntry } from '../log-entry';
import { LogTransport, LogTransportOptions } from '../log-transport';

const DEFAULT_TIMEOUT = 5000;

/**
 * Options for configuring a webhook log transport.
 */
export interface WebhookTransportOptions extends LogTransportOptions {
    /** The URL to which log entries will be sent via HTTP POST requests. */
    url: string;
    /** The maximum time, in milliseconds, to wait for the endpoint before the entry is dropped as a failure. Defaults to 5000. */
    timeout?: number;
}

export class WebhookTransport extends LogTransport {
    constructor(private readonly options: WebhookTransportOptions) {
        super(options);
    }

    async write(entry: LogEntry): Promise<void> {
        if (entry.level < this.options.minLevel) return;

        await fetch(this.options.url, {
            method: 'POST',
            signal: AbortSignal.timeout(this.options.timeout ?? DEFAULT_TIMEOUT),
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: this.options.formatter.format(entry)
            })
        });
    }
}
