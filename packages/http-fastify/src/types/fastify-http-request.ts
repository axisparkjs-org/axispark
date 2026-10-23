import {
    appendMultipartField,
    BadRequestError,
    FileUploadDefinition,
    FileUploadLimitError,
    HttpRequest,
    MultipartFields,
    UploadedFile
} from '@axisparkjs/http';
import { FastifyRequest } from 'fastify';
import type {} from '@fastify/multipart';

export class FastifyHttpRequest implements HttpRequest {
    private uploadedFiles?: readonly UploadedFile[];

    constructor(private readonly request: FastifyRequest) {}

    get method() {
        return this.request.method;
    }

    get path() {
        return this.request.url;
    }

    get url() {
        return this.request.url;
    }

    get headers() {
        return this.request.headers;
    }

    get query() {
        return this.request.query as Record<string, string | string[]>;
    }

    get params() {
        return this.request.params as Record<string, string>;
    }

    get body() {
        return this.request.body;
    }

    get ip() {
        return this.request.ip;
    }

    get session() {
        return (
            this.request as FastifyRequest & {
                session?: unknown;
            }
        ).session;
    }

    get cookies() {
        return (
            this.request as FastifyRequest & {
                cookies: Record<string, string>;
            }
        ).cookies;
    }

    get files() {
        return this.uploadedFiles;
    }

    getCookie(name: string): string | undefined {
        return this.cookies[name];
    }

    getHeader(name: string): string | string[] | undefined {
        const value = this.request.headers[name.toLowerCase()];

        if (Array.isArray(value)) {
            return value;
        }

        return value;
    }

    async parseMultipart(definition: FileUploadDefinition): Promise<void> {
        if (!this.request.isMultipart?.()) return;

        const files: UploadedFile[] = [];
        const fields: MultipartFields = {};

        try {
            const parts = this.request.parts({ limits: { fileSize: definition.maxFileSize, files: definition.maxFiles } });
            for await (const part of parts) {
                if (part.type === 'field') {
                    appendMultipartField(fields, part.fieldname, String(part.value));
                    continue;
                }

                if (!definition.isMimeTypeAllowed(part.mimetype)) {
                    part.file.resume();
                    throw new FileUploadLimitError('mimeType', definition.allowedMimeTypes?.length ?? 0);
                }

                const buffer = await part.toBuffer();
                files.push({ fieldName: part.fieldname, originalName: part.filename, mimeType: part.mimetype, size: buffer.length, buffer });
            }
        } catch (error) {
            throw FastifyHttpRequest.toUploadError(error, definition);
        }

        this.uploadedFiles = files;
        this.request.body = fields;
    }

    private static toUploadError(error: unknown, definition: FileUploadDefinition): Error {
        if (error instanceof FileUploadLimitError) return error;

        const code = (error as { code?: string }).code;
        if (code === 'FST_REQ_FILE_TOO_LARGE') return new FileUploadLimitError('fileSize', definition.maxFileSize);
        if (code === 'FST_FILES_LIMIT') return new FileUploadLimitError('files', definition.maxFiles);
        return new BadRequestError('Malformed multipart/form-data request.', { cause: error });
    }
}
