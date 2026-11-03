import { MetadataFromMethod } from '@axisparkjs/common';

/**
 * Options of the `@McpResource` decorator.
 */
export interface McpResourceOptions {
    /** The name of the resource. Defaults to the method name. */
    name?: string;
    /** A human-readable title for the resource. */
    title?: string;
    /** A description of the resource. */
    description?: string;
    /** The MIME type of the resource contents. */
    mimeType?: string;
}

export interface McpResourceMetadata extends MetadataFromMethod, McpResourceOptions {
    uri: string;
    name: string;
}
