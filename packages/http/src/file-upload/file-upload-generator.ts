import { Generator, Metadata, MetadataKeys } from '@axisparkjs/common';
import { Inject, Injectable } from '@axisparkjs/di';
import { ExecutionContext } from '@axisparkjs/engine';
import { HTTP_OPTIONS } from '../di/tokens';
import { HttpPluginOptions } from '../plugin/http-plugin-options';
import { FileUploadMetadata } from '../metadata/file-upload-metadata';
import { FileUploadDefinition } from './file-upload-definition';

export const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024;
export const DEFAULT_MAX_FILES = 10;

/** Generates the file upload limits for a handler. Precedence: handler decorator > controller decorator > global options. */
@Injectable()
export class FileUploadGenerator implements Generator<FileUploadDefinition> {
    constructor(@Inject(HTTP_OPTIONS) private readonly options: HttpPluginOptions) {}

    public generate(context: ExecutionContext): FileUploadDefinition {
        const classMetadata = Metadata.get<FileUploadMetadata>(MetadataKeys.FILE_UPLOAD, context.target);
        const methodMetadata = Metadata.get<FileUploadMetadata>(MetadataKeys.FILE_UPLOAD, context.target, context.propertyKey);
        const defaults = this.options.fileUploadOptions;
        const options = { ...defaults, ...classMetadata?.options, ...methodMetadata?.options };

        return new FileUploadDefinition(
            options.maxFileSize ?? DEFAULT_MAX_FILE_SIZE,
            options.maxFiles ?? DEFAULT_MAX_FILES,
            options.allowedMimeTypes?.map((mimeType) => mimeType.toLowerCase()),
            options.message
        );
    }
}
