import { MetadataFromMethod } from '@axisparkjs/common';

/**
 * An argument accepted by a prompt.
 */
export interface McpPromptArgument {
    /** The name of the argument. */
    name: string;
    /** A description of the argument. */
    description?: string;
    /** Whether the argument is required. */
    required?: boolean;
}

/**
 * Options of the `@McpPrompt` decorator.
 */
export interface McpPromptOptions {
    /** A description of the prompt. */
    description?: string;
    /** A human-readable title for the prompt. */
    title?: string;
    /** The arguments of the prompt. They replace the arguments generated from the `@McpArgs()` class. */
    arguments?: McpPromptArgument[];
}

export interface McpPromptMetadata extends MetadataFromMethod, McpPromptOptions {
    name: string;
}
