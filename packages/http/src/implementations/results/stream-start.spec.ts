import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { toReadable, waitForFirstChunk } from './stream-start';

describe('toReadable', () => {
    it('should return the same Readable', () => {
        const stream = Readable.from(['a']);

        expect(toReadable(stream)).toBe(stream);
    });

    it('should wrap a stream of the old API', async () => {
        const old = new EventEmitter() as unknown as NodeJS.ReadableStream;
        Object.assign(old, { pause: jest.fn(), resume: jest.fn() });

        const readable = toReadable(old);
        const chunks: Buffer[] = [];
        readable.on('data', (chunk: Buffer) => chunks.push(chunk));
        (old as unknown as EventEmitter).emit('data', Buffer.from('hello'));
        (old as unknown as EventEmitter).emit('end');
        await new Promise((resolve) => readable.once('end', resolve));

        expect(readable).toBeInstanceOf(Readable);
        expect(Buffer.concat(chunks).toString()).toBe('hello');
    });
});

describe('waitForFirstChunk', () => {
    it('should resolve when the first chunk is available, without consuming it', async () => {
        const stream = Readable.from(['first', 'second']);

        await waitForFirstChunk(stream);

        const chunks: string[] = [];
        for await (const chunk of stream) chunks.push(chunk as string);
        expect(chunks).toEqual(['first', 'second']);
    });

    it('should resolve at once when data is already buffered', async () => {
        const stream = new Readable({ read() {} });
        stream.push('data');

        await expect(waitForFirstChunk(stream)).resolves.toBeUndefined();
    });

    it('should resolve for an empty stream', async () => {
        await expect(waitForFirstChunk(Readable.from([]))).resolves.toBeUndefined();
    });

    it('should resolve at once for a stream that already ended', async () => {
        const stream = Readable.from([]);
        stream.resume();
        await new Promise((resolve) => stream.once('end', resolve));

        await expect(waitForFirstChunk(stream)).resolves.toBeUndefined();
    });

    it('should reject when the stream fails before the first chunk', async () => {
        const error = new Error('upstream failed');
        const stream = new Readable({
            read() {
                this.destroy(error);
            }
        });

        await expect(waitForFirstChunk(stream)).rejects.toBe(error);
    });

    it('should reject at once for a stream that already failed', async () => {
        const error = new Error('failed');
        const stream = new Readable({ read() {} });
        stream.on('error', () => undefined);
        stream.destroy(error);
        await new Promise((resolve) => stream.once('close', resolve));

        await expect(waitForFirstChunk(stream)).rejects.toBe(error);
    });

    it('should resolve when the stream is closed without an error', async () => {
        const stream = new Readable({ read() {} });

        const waiting = waitForFirstChunk(stream);
        stream.destroy();

        await expect(waiting).resolves.toBeUndefined();
    });

    it('should reject when the stream is closed with an error and no error listener sees it first', async () => {
        const error = new Error('closed with error');
        const stream = new Readable({ read() {} });
        const waiting = waitForFirstChunk(stream);
        stream.removeAllListeners('error');
        stream.on('error', () => undefined);
        stream.destroy(error);

        await expect(waiting).rejects.toBe(error);
    });
});
