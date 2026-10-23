import {
    appendMultipartField,
    BadRequestError,
    FileUploadDefinition,
    FileUploadLimitError,
    HttpRequest,
    MultipartFields,
    UploadedFile
} from '@axisparkjs/http';
import { Request } from 'express';
import busboy from 'busboy';

export class ExpressHttpRequest implements HttpRequest {
    private uploadedFiles?: readonly UploadedFile[];

    constructor(private readonly request: Request) {}

    get method() {
        return this.request.method;
    }

    get path() {
        return this.request.path;
    }

    get url() {
        return this.request.originalUrl;
    }

    get headers() {
        return this.request.headers;
    }

    get query() {
        return this.request.query as Record<string, string | string[]>;
    }

    get params() {
        return this.request.params;
    }

    get body() {
        return this.request.body;
    }

    get ip() {
        return this.request.ip;
    }

    get session() {
        return this.request.session;
    }

    get cookies() {
        return this.request.cookies;
    }

    get files() {
        return this.uploadedFiles;
    }

    getCookie(name: string): string | undefined {
        return this.request.cookies[name];
    }

    getHeader(name: string): string | string[] | undefined {
        return this.request.get(name);
    }

    parseMultipart(definition: FileUploadDefinition): Promise<void> {
        return new Promise((resolve, reject) => {
            const files: UploadedFile[] = [];
            const fields: MultipartFields = {};
            const pendingFiles: Promise<void>[] = [];
            let failed = false;

            let parser: busboy.Busboy;
            try {
                parser = busboy({ headers: this.request.headers, limits: { fileSize: definition.maxFileSize, files: definition.maxFiles } });
            } catch (error) {
                reject(new BadRequestError('Malformed multipart/form-data request.', { cause: error }));
                return;
            }

            const fail = (error: Error) => {
                if (failed) return;
                failed = true;
                this.request.unpipe(parser);
                this.request.resume();
                reject(error);
            };

            parser.on('file', (fieldName, stream, info) => {
                if (!definition.isMimeTypeAllowed(info.mimeType)) {
                    stream.resume();
                    fail(new FileUploadLimitError('mimeType', definition.allowedMimeTypes?.length ?? 0));
                    return;
                }

                const chunks: Buffer[] = [];
                stream.on('data', (chunk: Buffer) => chunks.push(chunk));
                stream.on('limit', () => fail(new FileUploadLimitError('fileSize', definition.maxFileSize)));
                pendingFiles.push(
                    new Promise<void>((resolveFile) => {
                        stream.on('close', () => {
                            const buffer = Buffer.concat(chunks);
                            files.push({ fieldName, originalName: info.filename ?? '', mimeType: info.mimeType, size: buffer.length, buffer });
                            resolveFile();
                        });
                    })
                );
            });
            parser.on('field', (name, value) => appendMultipartField(fields, name, value));
            parser.on('filesLimit', () => fail(new FileUploadLimitError('files', definition.maxFiles)));
            parser.on('error', (error) => fail(new BadRequestError('Malformed multipart/form-data request.', { cause: error })));
            parser.on('close', async () => {
                await Promise.all(pendingFiles);
                if (failed) return;
                this.uploadedFiles = files;
                this.request.body = fields;
                resolve();
            });

            this.request.pipe(parser);
        });
    }
}
