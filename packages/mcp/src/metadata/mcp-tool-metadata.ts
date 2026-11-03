import { MetadataFromMethod } from '@axisparkjs/common';
import { JsonSchema } from '../schema/json-schema';

/**
 * Hints that describe the behavior of a tool to the clients. They are hints, not guarantees.
 */
export interface McpToolAnnotations {
    /** A human-readable title for the tool. */
    title?: string;
    /** If true, the tool does not modify its environment. */
    readOnlyHint?: boolean;
    /** If true, the tool may perform destructive updates. Only meaningful when `readOnlyHint` is false. */
    destructiveHint?: boolean;
    /** If true, calling the tool repeatedly with the same arguments has no additional effect. */
    idempotentHint?: boolean;
    /** If true, the tool may interact with an open world of external entities. */
    openWorldHint?: boolean;
}

/**
 * Options of the `@McpTool` decorator.
 */
export interface McpToolOptions {
    /** A description of what the tool does, used by the clients and the models to decide when to call it. */
    description?: string;
    /** A human-readable title for the tool. */
    title?: string;
    /** Hints about the behavior of the tool. */
    annotations?: McpToolAnnotations;
    /** A JSON Schema for the tool input. It replaces the schema generated from the `@McpArgs()` class. */
    inputSchema?: JsonSchema;
}

export interface McpToolMetadata extends MetadataFromMethod, McpToolOptions {
    name: string;
}
