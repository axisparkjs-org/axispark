import { FileUploadLimitReason } from '../plugin/http-plugin-options';

/**
 * An adapter-agnostic error raised while parsing a multipart request when an upload limit is exceeded.
 * The file upload guard translates it into the corresponding HTTP error.
 */
export class FileUploadLimitError extends Error {
    constructor(
        public readonly reason: FileUploadLimitReason,
        public readonly limit: number
    ) {
        super(`File upload limit exceeded: ${reason} (${limit})`);
        this.name = this.constructor.name;
    }
}
