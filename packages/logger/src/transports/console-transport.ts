import { SonicBoom } from 'sonic-boom';
import { LogEntry } from '../log-entry';
import { LogTransport, LogTransportOptions } from '../log-transport';

/**
 * Options for configuring a console log transport.
 */
export interface ConsoleTransportOptions extends LogTransportOptions {
    /**
     * Whether to write the entries to the standard output with a buffered asynchronous stream instead of `console.log`, which is synchronous
     * when the standard output is a file or a pipe and blocks the event loop under load. The entries that are still in the buffer are
     * written when the process exits and when the application is destroyed. Defaults to `true`; `false` writes each entry with `console.log`.
     */
    buffered?: boolean;
}

/* The size of the buffer: the entries are written when it is full, or at the end of the current tick of the event loop. */
const BUFFER_SIZE = 4096;

/* One stream for every console transport of the process, so the entries of different transports keep their order. */
let stdout: SonicBoom | undefined;
let flushScheduled = false;

function getStdout(): SonicBoom {
    if (!stdout) {
        const stream = new SonicBoom({ fd: process.stdout.fd ?? 1, sync: false, minLength: BUFFER_SIZE });
        process.on('exit', () => {
            try {
                stream.flushSync();
            } catch {
                // The standard output can be closed when the process exits.
            }
        });
        stdout = stream;
    }
    return stdout;
}

/**
 * A log transport that outputs log entries to the console. By default, the entries are written to the standard output with a buffered
 * asynchronous stream (`sonic-boom`), shared by every console transport of the process, so logging does not block the requests.
 */
export class ConsoleTransport extends LogTransport {
    constructor(protected readonly options: ConsoleTransportOptions) {
        super(options);
    }

    async write(entry: LogEntry): Promise<void> {
        if (entry.level < this.config.minLevel) return;

        const line = this.config.formatter.format(entry);
        if (this.options.buffered === false) {
            console.log(line);
            return;
        }
        const stream = getStdout();
        stream.write(line + '\n');
        if (flushScheduled) return;
        flushScheduled = true;
        setImmediate(() => {
            flushScheduled = false;
            stream.flush();
        });
    }

    /** Writes the entries that are still in the buffer of the standard output and waits for them. */
    override async flush(): Promise<void> {
        if (!stdout) return;
        const stream = stdout;
        // The callback receives an error when the stream is closed: there is nothing else to write then.
        await new Promise<void>((resolve) => stream.flush(() => resolve()));
    }
}
