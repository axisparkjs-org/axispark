import { MetadataFromClassOrMethod } from '@axisparkjs/common';
import { FileUploadOptions } from '../plugin/http-plugin-options';

/** File upload metadata declared on a class or method. */
export interface FileUploadMetadata extends MetadataFromClassOrMethod {
    options: Partial<FileUploadOptions>;
}
