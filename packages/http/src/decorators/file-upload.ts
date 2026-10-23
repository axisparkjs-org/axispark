import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { FileUploadMetadata } from '../metadata/file-upload-metadata';
import { FileUploadOptions } from '../plugin/http-plugin-options';

/**
 * Overrides the file upload limits for a controller or a handler. Missing values fall back to the controller options and then to the global `fileUploadOptions`.
 * It has no effect when the `fileUpload` option of the HTTP plugin is disabled.
 * @param options The file upload limits to apply.
 */
export function FileUpload(options: Partial<FileUploadOptions> = {}): MethodDecorator & ClassDecorator {
    return (target: object, propertyKey?: string | symbol) => {
        const metadata: FileUploadMetadata = {
            target: Metadata.normalizeTarget(target),
            propertyKey,
            options
        };

        if (propertyKey !== undefined) Metadata.define(MetadataKeys.FILE_UPLOAD, metadata, target, propertyKey);
        else Metadata.define(MetadataKeys.FILE_UPLOAD, metadata, target);
    };
}
