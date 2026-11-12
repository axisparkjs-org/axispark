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

    file(filePath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.response.sendFile(filePath, { dotfiles: 'allow' }, (error?: Error) => {
                // Once the response has started, the error (such as a client that disconnects) can not be answered.
                if (error && !this.response.headersSent) reject(error);
                else resolve();
            });
        });
    }

    stream(stream: NodeJS.ReadableStream): void {
        stream.pipe(this.response);
    }

    end(): void {
        this.response.end();
    }

    isCommitted(): boolean {
        return this.response.headersSent;
    }
}
