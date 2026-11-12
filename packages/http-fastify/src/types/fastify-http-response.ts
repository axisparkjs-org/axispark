import path from 'node:path';
import { HttpResponse } from '@axisparkjs/http';
import { SerializeOptions } from '@fastify/cookie';
import { FastifyReply } from 'fastify';

export class FastifyHttpResponse implements HttpResponse {
    constructor(private readonly response: FastifyReply) {}

    status(code: number): this {
        this.response.status(code);
        return this;
    }

    header(name: string, value: string): this {
        this.response.header(name, value);
        return this;
    }

    cookie(name: string, value: string, options?: SerializeOptions): this {
        this.response.cookie(name, value, options);
        return this;
    }

    clearCookie(name: string, options?: SerializeOptions): this {
        this.response.clearCookie(name, options);
        return this;
    }

    json(body?: unknown): void {
        this.response.send(body);
    }

    send(body?: unknown): void {
        this.response.send(body);
    }

    file(filePath: string): Promise<void> {
        return new Promise((resolve) => {
            const raw = this.response.raw;
            const done = () => {
                raw.off('finish', done);
                raw.off('close', done);
                resolve();
            };
            raw.once('finish', done);
            raw.once('close', done);
            // The file is sent from its own folder, so the path does not depend on the root of the static files,
            // and the Content-Type is only set from the extension when the result has not set it.
            this.response.sendFile(path.basename(filePath), path.dirname(filePath), {
                dotfiles: 'allow',
                contentType: !this.response.hasHeader('content-type')
            });
        });
    }

    stream(stream: NodeJS.ReadableStream): void {
        this.response.send(stream);
    }

    end(): void {
        this.response.send();
    }

    isCommitted(): boolean {
        return this.response.sent;
    }
}
