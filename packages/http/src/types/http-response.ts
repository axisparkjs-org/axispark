/**
 * Represents an HTTP response, providing methods to set status codes, headers, cookies, and send various types of responses such as JSON, files, or streams. Also includes methods to clear cookies and check if the response has been committed.
 */
export interface HttpResponse {
    /** The status code of the response. It can be read after the response has been sent. */
    readonly statusCode: number;
    status(code: number): this;
    header(name: string, value: string): this;
    cookie(
        name: string,
        value: string,
        options?: { maxAge?: number; path?: string; domain?: string; secure?: boolean; httpOnly?: boolean; sameSite?: boolean | 'lax' | 'strict' | 'none' }
    ): this;
    clearCookie(
        name: string,
        options?: { path?: string; domain?: string; secure?: boolean; httpOnly?: boolean; sameSite?: boolean | 'lax' | 'strict' | 'none' }
    ): this;
    json(body?: any): void;
    send(body?: any): void;
    file(filePath: string): void;
    stream(stream: NodeJS.ReadableStream): void;
    end(): void;
    isCommitted(): boolean;
}
