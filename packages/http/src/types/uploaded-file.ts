/**
 * Represents a file received in a `multipart/form-data` request.
 */
export interface UploadedFile {
    /** The name of the form field the file was sent in. */
    fieldName: string;
    /** The file name provided by the client. */
    originalName: string;
    /** The MIME type declared by the client. */
    mimeType: string;
    /** The size of the file in bytes. */
    size: number;
    /** The contents of the file. */
    buffer: Buffer;
}
