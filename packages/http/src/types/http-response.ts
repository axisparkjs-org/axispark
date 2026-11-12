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
    file(filePath: string): void;
    /**
     * Sends a stream. The source is destroyed when the client closes the connection, and the connection is destroyed when the source fails.
     * @param stream The stream to send.
     * @returns A promise that resolves when the transfer ends, and rejects with the error of the source.
     */
    stream(stream: NodeJS.ReadableStream): Promise<void>;
    end(): void;
    isCommitted(): boolean;
}
