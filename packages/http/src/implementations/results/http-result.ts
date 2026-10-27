import { ResultDefinition } from '@axisparkjs/engine';
import { HttpStatusCode, HttpContext } from '../../types';
import { HttpError, RateLimitExceededError } from '../errors';

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
    public constructor(
        private readonly filePath: string,
        private readonly options?: { filename?: string; contentType?: string }
    ) {
        super(undefined, HttpStatusCode.Ok);
    }

    public async process(context: HttpContext): Promise<void> {
        const { filename, contentType } = this.options || {};
        if (contentType) {
            context.response.header('Content-Type', contentType);
        }
        if (filename) {
            context.response.header('Content-Disposition', `attachment; filename="${filename}"`);
        }
        context.response.file(this.filePath);
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

    public async process(context: HttpContext): Promise<void> {
        const { filename, contentType } = this.options || {};
        if (contentType) {
            context.response.header('Content-Type', contentType);
        }
        if (filename) {
            context.response.header('Content-Disposition', `attachment; filename="${filename}"`);
        }
        context.response.stream(this.stream);
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
