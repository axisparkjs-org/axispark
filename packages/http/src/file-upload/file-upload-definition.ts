import { FileUploadOptions } from '../plugin/http-plugin-options';

/**
 * The effective file upload limits for one handler, after merging handler, controller and global options.
 */
export class FileUploadDefinition {
    constructor(
        public readonly maxFileSize: number,
        public readonly maxFiles: number,
        public readonly allowedMimeTypes?: readonly string[],
        public readonly message?: FileUploadOptions['message']
    ) {}

    /** Checks whether a MIME type is allowed. All MIME types are allowed when no list is configured. */
    public isMimeTypeAllowed(mimeType: string): boolean {
        if (!this.allowedMimeTypes) return true;
        return this.allowedMimeTypes.includes(mimeType.toLowerCase());
    }
}
