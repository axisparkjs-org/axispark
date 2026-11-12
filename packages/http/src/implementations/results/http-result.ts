import { ResultDefinition } from '@axisparkjs/engine';
import { HttpStatusCode, HttpContext } from '../../types';
import { HttpError, InternalServerError, NotFoundError, RateLimitExceededError } from '../errors';
import { contentDisposition } from './content-disposition';
import { toReadable, waitForFirstChunk } from './stream-start';
import { stat } from 'node:fs/promises';
import path from 'node:path';

/**
 * An abstract class for representing HTTP results.
 */
export abstract class HttpResult<T = unknown> extends ResultDefinition<T> {
    public constructor(value: T, rc: HttpStatusCode) {
        super(value, rc);
    }

    abstract process(context: HttpContext): Promise<void>;
}
/**
 * A class for representing HTTP results with a body.
 */
export class BodyHttpResult<T = unknown> extends HttpResult<T> {
    public constructor(
        value: T,
        rc: HttpStatusCode,
        private readonly headers: Record<string, string> = {}
    ) {
        super(value, rc);
    }

    public header(name: string, value: string): this {
        this.headers[name] = value;
        return this;
    }

    public async process(context: HttpContext): Promise<void> {
        context.response.status(this.rc);
        for (const [name, value] of Object.entries(this.headers)) {
            context.response.header(name, value);
        }
        if (this.value === undefined) {
            context.response.end();
            return;
        }
        if (typeof this.value === 'string') {
            context.response.send(this.value);
            return;
        }
        context.response.json(this.value);
    }
}
/**
 * A class for representing HTTP redirect results.
 */
export class RedirectHttpResult extends HttpResult<undefined> {
    public constructor(
        private readonly location: string,
        permanent = false
    ) {
        const rc = permanent ? HttpStatusCode.MovedPermanently : HttpStatusCode.Found;
        super(undefined, rc);
    }

    public async process(context: HttpContext): Promise<void> {
        context.response.status(this.rc);
        context.response.header('Location', this.location);
        context.response.end();
    }
}
/**
 * A class for representing HTTP file results.
 */
export class FileHttpResult extends HttpResult<undefined> {
    /**
     * Creates a file result.
     * @param filePath The absolute path of the file, the same with every adapter. Build it with `path.join(__dirname, ...)`, for example.
     * @param options The name of the downloaded file and the content type.
     * @throws {Error} If the path is relative, because each adapter would resolve it against a different folder.
     */
    public constructor(
        private readonly filePath: string,
        private readonly options?: { filename?: string; contentType?: string }
    ) {
        super(undefined, HttpStatusCode.Ok);
        if (!path.isAbsolute(filePath)) {
            throw new Error(`The path of a file result must be absolute, but "${filePath}" is relative. Build it with path.join(__dirname, ...), for example.`);
        }
    }

    /**
     * Sends the file, or answers `404` in the format of the framework when the file does not exist.
     * @param context The HTTP context of the request.
     */
    public async process(context: HttpContext): Promise<void> {
        if (!(await FileHttpResult.isFile(this.filePath))) {
            await new ErrorHttpResult(new NotFoundError('File not found')).process(context);
            return;
        }

        const { filename, contentType } = this.options || {};
        if (contentType) {
            context.response.header('Content-Type', contentType);
        }
        if (filename) {
            context.response.header('Content-Disposition', contentDisposition(filename));
        }
        await context.response.file(this.filePath);
    }

    private static async isFile(filePath: string): Promise<boolean> {
        try {
            return (await stat(filePath)).isFile();
        } catch {
            return false;
        }
    }
}
/**
 * A class for representing HTTP stream results.
 */
export class StreamHttpResult extends HttpResult<undefined> {
    public constructor(
        private readonly stream: NodeJS.ReadableStream,
        private readonly options?: { filename?: string; contentType?: string }
    ) {
        super(undefined, HttpStatusCode.Ok);
    }

    /**
     * Sends the stream and waits for the end of the transfer.
     *
     * - When the stream fails before sending any data, the request is answered with `500` in the format of the framework.
     * - When the stream fails after the response has started, the connection is destroyed, so the client sees an incomplete transfer.
     *
     * In both cases the error of the stream is thrown after the response is handled, so it is logged.
     * @param context The HTTP context of the request.
     * @throws {Error} The error of the stream.
     */
    public async process(context: HttpContext): Promise<void> {
        const source = toReadable(this.stream);
        try {
            await waitForFirstChunk(source);
        } catch (error) {
            source.destroy();
            await new ErrorHttpResult(new InternalServerError('Stream failed')).process(context);
            throw error;
        }

        const { filename, contentType } = this.options || {};
        if (contentType) {
            context.response.header('Content-Type', contentType);
        }
        if (filename) {
            context.response.header('Content-Disposition', contentDisposition(filename));
        }

        try {
            await context.response.stream(source);
        } catch (error) {
            // The client closed the connection before the end: the source is already destroyed and there is nothing to answer.
            if ((error as NodeJS.ErrnoException).code === 'ERR_STREAM_PREMATURE_CLOSE') return;
            throw error;
        }
    }
}
/**
 * A class for representing HTTP error results.
 */
export class ErrorHttpResult extends HttpResult<HttpError> {
    public constructor(value: HttpError) {
        super(value, value.status);
    }

    public async process(context: HttpContext): Promise<void> {
        context.response.status(this.rc);
        if (this.value instanceof RateLimitExceededError) {
            context.response.json({ message: this.value.response });
            return;
        }

        context.response.json({
            error: this.value.message,
            status: this.rc,
            cause: this.value.options?.cause,
            description: this.value.options?.description
        });
    }
}
