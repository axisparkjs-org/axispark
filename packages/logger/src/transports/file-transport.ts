import { createWriteStream, WriteStream } from 'node:fs';
import { LogEntry } from '../log-entry';
import { LogTransport, LogTransportOptions } from '../log-transport';

/**
 * Options for configuring a file log transport.
 */
export interface FileTransportOptions extends LogTransportOptions {
    /** The path to the file where log entries will be written. */
    file: string;
}

/**
 * A log transport that outputs log entries to a file. The file is kept open with a `WriteStream` in append mode, instead of being opened
 * and closed for every entry, and the stream writes the pending entries together. The entries are written in the order of the calls, and
 * each call resolves when its entry is written, or rejects with the error of the file. A file that fails is opened again by the next entry.
 */
export class FileTransport extends LogTransport {
    private stream?: WriteStream;
    private streamFile?: string;
    private queue: Promise<unknown> = Promise.resolve();

    constructor(protected readonly options: FileTransportOptions) {
        super(options);
    }

    protected getFile(_entry: LogEntry): string {
        return this.options.file;
    }

    protected async beforeWrite(_entry: LogEntry): Promise<void> {
        /* empty */
    }

    async write(entry: LogEntry): Promise<void> {
        if (entry.level < this.options.minLevel) return;

        const data = this.options.formatter.format(entry) + '\n';
        // The preparation (rotation, change of file) runs in order; the entries are then written by the stream, also in order.
        // The promise of the write is wrapped, so the queue does not wait for the file.
        const prepared = this.queue.then(async () => {
            await this.beforeWrite(entry);
            return { written: this.append(this.getFile(entry), data) };
        });
        this.queue = prepared.catch(() => undefined);
        await (
            await prepared
        ).written;
    }

    /**
     * Writes data to a file through the stream of the transport, opening it when it is not open or the file changed.
     * @param file The path of the file.
     * @param data The data to write.
     * @returns A promise that resolves when the data is written.
     */
    protected append(file: string, data: string): Promise<void> {
        const stream = this.openStream(file);
        return new Promise<void>((resolve, reject) => {
            stream.write(data, (error) => (error ? reject(error) : resolve()));
        });
    }

    /** Ends the stream of the file, after its pending entries are written. The next entry opens the file again. */
    protected async closeStream(): Promise<void> {
        const stream = this.stream;
        this.stream = undefined;
        this.streamFile = undefined;
        if (!stream || stream.destroyed) return;
        await new Promise<void>((resolve) => stream.end(() => resolve()));
    }

    /** Waits for the pending entries and closes the file, which is opened again by the next entry. */
    override async flush(): Promise<void> {
        await this.queue;
        await this.closeStream();
    }

    private openStream(file: string): WriteStream {
        if (this.stream && this.streamFile === file && !this.stream.destroyed) return this.stream;

        this.stream?.end();
        const stream = createWriteStream(file, { flags: 'a' });
        // The error is also received by the callbacks of the pending writes, so it is reported to the Logger by them.
        stream.on('error', () => {
            if (this.stream !== stream) return;
            this.stream = undefined;
            this.streamFile = undefined;
        });
        this.stream = stream;
        this.streamFile = file;
        return stream;
    }
}
