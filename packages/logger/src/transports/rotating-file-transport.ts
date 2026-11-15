import { rename, stat } from 'node:fs/promises';

import { dirname, extname, basename, join } from 'node:path';

import { FileTransport, FileTransportOptions } from './file-transport';

/**
 * Options for configuring a rotating file log transport.
 */
export interface RotatingFileTransportOptions extends FileTransportOptions {
    /** The maximum size of the log file in bytes before rotation occurs. */
    maxSize: number;
    /** The maximum number of rotated log files to keep. */
    maxFiles: number;
}

/**
 * A log transport that outputs log entries to a file, and rotates it when it reaches `maxSize` bytes. The size of the file is read once and
 * then counted in memory, and the file is closed before it is rotated.
 */
export class RotatingFileTransport extends FileTransport {
    protected readonly options: RotatingFileTransportOptions;
    private size?: number;

    constructor(options: RotatingFileTransportOptions) {
        super(options);
        this.options = options;
    }

    protected override async beforeWrite(): Promise<void> {
        if (this.size === undefined) {
            try {
                this.size = (await stat(this.options.file)).size;
            } catch {
                this.size = 0;
            }
        }

        if (this.size >= this.options.maxSize) {
            await this.closeStream();
            await this.rotate();
            this.size = 0;
        }
    }

    protected override append(file: string, data: string): Promise<void> {
        this.size = (this.size ?? 0) + Buffer.byteLength(data);
        return super.append(file, data);
    }

    private async rotate(): Promise<void> {
        const maxFiles = this.options.maxFiles;

        const dir = dirname(this.options.file);
        const ext = extname(this.options.file);
        const name = basename(this.options.file, ext);

        for (let i = maxFiles - 1; i >= 1; i--) {
            const source = join(dir, `${name}.${i}${ext}`);
            const target = join(dir, `${name}.${i + 1}${ext}`);

            try {
                await rename(source, target);
            } catch {
                /* empty */
            }
        }

        try {
            await rename(this.options.file, join(dir, `${name}.1${ext}`));
        } catch {
            /* empty */
        }
    }
}
