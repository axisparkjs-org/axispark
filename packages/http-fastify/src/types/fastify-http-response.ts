import path from 'node:path';
import { PassThrough } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { HttpResponse } from '@axisparkjs/http';
import { SerializeOptions } from '@fastify/cookie';
import { FastifyReply } from 'fastify';

/**
 * The `HttpResponse` of the Fastify adapter. When the route has response schemas, the JSON responses whose body is an object or an array
 * that matches the root of the schema of the status code are serialized with the schema (`fast-json-stringify`); the other responses are
 * serialized by Fastify with `JSON.stringify`.
 */
export class FastifyHttpResponse implements HttpResponse {
    constructor(
        private readonly response: FastifyReply,
        private readonly schemas?: Readonly<Record<string, object>>
    ) {}

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
        const schema = this.schemaOf(body);
        if (schema) {
            if (!this.response.hasHeader('content-type')) this.response.type('application/json; charset=utf-8');
            this.response.serializer(this.response.compileSerializationSchema(schema, String(this.response.statusCode)));
        }
        this.response.send(body);
    }

    /* The schema of the status code, only when its root is the kind of the body: an object schema for objects, an array schema for arrays. */
    private schemaOf(body: unknown): Record<string, unknown> | undefined {
        if (!this.schemas || body === null || typeof body !== 'object') return undefined;

        const schema = (this.schemas[String(this.response.statusCode)] ?? this.schemas.default) as Record<string, unknown> | undefined;
        if (!schema) return undefined;

        const matches = Array.isArray(body) ? schema.type === 'array' : '$ref' in schema || schema.type === 'object';
        return matches ? schema : undefined;
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

    async stream(stream: NodeJS.ReadableStream): Promise<void> {
        const raw = this.response.raw;
        const sent = new Promise<void>((resolve) => {
            const done = () => {
                raw.off('finish', done);
                raw.off('close', done);
                resolve();
            };
            raw.once('finish', done);
            raw.once('close', done);
        });
        // Fastify sends the PassThrough: pipeline() destroys it, and so the connection, when the source fails,
        // and destroys the source when the client closes the connection.
        const body = new PassThrough();
        this.response.send(body);
        await Promise.all([pipeline(stream, body), sent]);
    }

    end(): void {
        this.response.send();
    }

    isCommitted(): boolean {
        return this.response.sent;
    }
}
