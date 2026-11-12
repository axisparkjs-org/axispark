import { pipeline } from 'node:stream/promises';
import { HttpResponse } from '@axisparkjs/http';
import { CookieOptions, Response } from 'express';

export class ExpressHttpResponse implements HttpResponse {
    constructor(private readonly response: Response) {}

    status(code: number): this {
        this.response.status(code);
        return this;
    }

    header(name: string, value: string): this {
        this.response.setHeader(name, value);
        return this;
    }

    cookie(name: string, value: string, options?: CookieOptions): this {
        this.response.cookie(name, value, options ?? {});
        return this;
    }

    clearCookie(name: string, options?: CookieOptions): this {
        this.response.clearCookie(name, options ?? {});
        return this;
    }

    json(body?: any): void {
        this.response.json(body);
    }

    send(body?: any): void {
        this.response.send(body);
    }

    file(filePath: string): void {
        this.response.sendFile(filePath);
    }

    async stream(stream: NodeJS.ReadableStream): Promise<void> {
        // pipeline() destroys the response when the source fails, and the source when the client closes the connection.
        await pipeline(stream, this.response);
    }

    end(): void {
        this.response.end();
    }

    isCommitted(): boolean {
        return this.response.headersSent;
    }
}
