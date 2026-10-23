import type { FileUploadDefinition } from '../file-upload/file-upload-definition';
import { UploadedFile } from './uploaded-file';

/**
 * Represents an HTTP request, including method, path, URL, headers, query parameters, route parameters, body, IP address, and cookies. Provides methods to retrieve specific cookies and headers.
 */
export interface HttpRequest {
    method: string;
    path: string;
    url: string;
    headers: Readonly<Record<string, string | string[] | undefined>>;
    query: Readonly<Record<string, string | string[]>>;
    params: Readonly<Record<string, string | string[]>>;
    body: unknown;
    ip: string | undefined;
    cookies: Readonly<Record<string, string | undefined>>;
    /**
     * The files received in a `multipart/form-data` request. Undefined until the request has been parsed with `parseMultipart`.
     */
    files?: readonly UploadedFile[];

    getCookie(name: string): string | undefined;
    getHeader(name: string): string | string[] | undefined;
    /**
     * Parses a `multipart/form-data` request applying the given limits. Files are exposed in `files` and text fields in `body`.
     * @throws FileUploadLimitError when a limit is exceeded.
     */
    parseMultipart?(definition: FileUploadDefinition): Promise<void>;
}
