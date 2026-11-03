import { ResultDefinition } from '@axisparkjs/engine';
import { McpCapability, McpContext } from '../../types';
import { McpError } from '../errors';
import { McpContent, McpPromptMessage } from './mcp-content';
import { McpResultConverter } from './mcp-result-converter';

/**
 * An abstract class for representing MCP results. Processing a result stores the response of the request in the context.
 */
export abstract class McpResult<T = unknown> extends ResultDefinition<T> {
    public constructor(value: T, rc = 0) {
        super(value, rc);
    }

    abstract process(context: McpContext): Promise<void>;
}

/**
 * A result for any value returned by a handler. The value is converted according to the kind of request.
 */
export class OkMcpResult<T = unknown> extends McpResult<T> {
    public async process(context: McpContext): Promise<void> {
        context.response = { result: McpResultConverter.fromValue(this.value, context) };
    }
}

/**
 * A result made of content blocks, such as texts, images or embedded resources.
 */
export class ContentMcpResult extends McpResult<{ content: McpContent[]; structuredContent?: Record<string, unknown> }> {
    public async process(context: McpContext): Promise<void> {
        context.response = { result: McpResultConverter.fromContent(this.value.content, this.value.structuredContent, context) };
    }
}

/**
 * A result made of prompt messages.
 */
export class MessagesMcpResult extends McpResult<{ messages: McpPromptMessage[]; description?: string }> {
    public async process(context: McpContext): Promise<void> {
        context.response = { result: McpResultConverter.fromMessages(this.value.messages, this.value.description, context) };
    }
}

/**
 * A result sent to the client as it is, without any conversion.
 */
export class RawMcpResult extends McpResult<Record<string, unknown>> {
    public async process(context: McpContext): Promise<void> {
        context.response = { result: this.value };
    }
}

/**
 * A result for errors. Tools return it as a tool result with `isError: true`, so the model can see the error and recover from it. Resources and prompts return it as a JSON-RPC error.
 */
export class ErrorMcpResult extends McpResult<McpError> {
    public constructor(error: McpError) {
        super(error, error.code);
    }

    public async process(context: McpContext): Promise<void> {
        if (context.request.capability === McpCapability.Tool) {
            context.response = { result: { content: [{ type: 'text', text: this.value.message }], isError: true } };
            return;
        }
        context.response = { error: this.value };
    }
}
