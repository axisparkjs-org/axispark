import { HttpResponse } from '@axisparkjs/http';
import { SerializeOptions } from '@fastify/cookie';
import { FastifyReply } from 'fastify';

export class FastifyHttpResponse implements HttpResponse {
    constructor(private readonly response: FastifyReply) {}

    get statusCode(): number {
        return this.response.statusCode;
    }

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

    file(filePath: string): void {
        this.response.sendFile(filePath);
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
