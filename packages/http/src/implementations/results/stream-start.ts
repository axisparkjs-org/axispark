import { Readable } from 'node:stream';

/**
 * Converts a readable stream to a `Readable` of Node.js, wrapping the streams of the old API.
 * @param stream The stream to convert.
 * @returns The same stream when it is already a `Readable`, or a `Readable` that wraps it.
 */
export function toReadable(stream: NodeJS.ReadableStream): Readable {
    return stream instanceof Readable ? stream : new Readable({ objectMode: false }).wrap(stream);
}

/**
 * Waits until a stream has its first chunk of data, or ends, without consuming the data. A stream that fails before sending any data rejects, so the error can still be answered with a status code.
 * @param stream The stream to wait for.
 * @returns A promise that resolves when the first chunk is available or the stream ends, and rejects with the error of the stream.
 */
export function waitForFirstChunk(stream: Readable): Promise<void> {
    if (stream.readableLength > 0 || stream.readableEnded) return Promise.resolve();
    if (stream.errored) return Promise.reject(stream.errored);

    return new Promise<void>((resolve, reject) => {
        const cleanup = () => {
            stream.off('readable', onReadable);
            stream.off('error', onError);
            stream.off('close', onClose);
        };
        const onReadable = () => {
            cleanup();
            resolve();
        };
        const onError = (error: Error) => {
            cleanup();
            reject(error);
        };
        const onClose = () => {
            cleanup();
            if (stream.errored) reject(stream.errored);
            else resolve();
        };
        stream.once('readable', onReadable);
        stream.once('error', onError);
        stream.once('close', onClose);
    });
}
