import { Check, Context, ExecutionTransport, Guard, StepPriority } from '@axisparkjs/engine';
import { FileUploadDefinition, FileUploadGenerator, FileUploadLimitError } from '../../file-upload';
import { HttpContext, HttpRequest } from '../../types';
import { ContentTooLargeError, HttpError, UnsupportedMediaTypeError } from '../errors';

const DEFAULT_MESSAGES = {
    fileSize: (limit: number) => `File exceeds the maximum allowed size of ${limit} bytes.`,
    files: (limit: number) => `Too many files. The maximum allowed is ${limit}.`,
    mimeType: () => 'Unsupported file type.'
};

/**
 * Parses `multipart/form-data` requests applying the handler limits and raises the standard HTTP error when a limit is exceeded.
 * It runs after the authentication and authorization guards so files are never buffered for rejected requests.
 */
@Guard({ transport: ExecutionTransport.Http, priority: StepPriority.Base })
export class FileUploadGuard {
    constructor(private readonly fileUploadGenerator: FileUploadGenerator) {}

    @Check()
    public async failedCheckFileUpload(@Context() context: HttpContext): Promise<void> {
        const request = context.request;
        if (!request.parseMultipart || !FileUploadGuard.isMultipart(request)) return;

        const definition = this.fileUploadGenerator.generate(context);
        try {
            await request.parseMultipart(definition);
        } catch (error) {
            if (error instanceof FileUploadLimitError) throw FileUploadGuard.toHttpError(error, definition);
            throw error;
        }
    }

    private static isMultipart(request: HttpRequest): boolean {
        const contentType = request.headers['content-type'];
        const value = Array.isArray(contentType) ? contentType[0] : contentType;
        return value?.toLowerCase().startsWith('multipart/form-data') ?? false;
    }

    private static toHttpError(error: FileUploadLimitError, definition: FileUploadDefinition): HttpError {
        const message = FileUploadGuard.getMessage(error, definition);
        if (error.reason === 'mimeType') return new UnsupportedMediaTypeError(message);
        return new ContentTooLargeError(message);
    }

    private static getMessage(error: FileUploadLimitError, definition: FileUploadDefinition): string {
        const message = definition.message;
        if (typeof message === 'function') return message(error.limit, error.reason);
        return message ?? DEFAULT_MESSAGES[error.reason](error.limit);
    }
}
