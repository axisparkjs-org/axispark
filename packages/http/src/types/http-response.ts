/**
 * Represents an HTTP response, providing methods to set status codes, headers, cookies, and send various types of responses such as JSON, files, or streams. Also includes methods to clear cookies and check if the response has been committed.
 */
export interface HttpResponse {
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
    /**
     * Sends a file. The headers that are already set, such as `Content-Type` and `Content-Disposition`, are kept.
     * @param filePath The absolute path of the file.
     * @returns A promise that resolves when the file is sent, and rejects when it can not be sent before any byte of the response is written.
     */
    file(filePath: string): Promise<void>;
    stream(stream: NodeJS.ReadableStream): void;
    end(): void;
    isCommitted(): boolean;
}
