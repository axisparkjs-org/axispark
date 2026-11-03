import { McpCapability, McpContext } from '../../types';
import { McpContent, McpPromptMessage, McpResourceContents } from './mcp-content';

/**
 * Encodes binary data in base64.
 * @param data The data to encode, or a string already encoded in base64.
 * @returns The data encoded in base64.
 */
export function toBase64(data: string | Uint8Array): string {
    return typeof data === 'string' ? data : Buffer.from(data).toString('base64');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Uint8Array);
}

/**
 * A static class that converts the values returned by MCP handlers into the result of each kind of request.
 */
export class McpResultConverterStatic {
    /**
     * Converts the value returned by a handler. A string becomes a text content, an object becomes JSON, binary data becomes a blob and `undefined` an empty result.
     * @param value The value returned by the handler.
     * @param context The context of the request.
     * @returns The MCP result.
     */
    public fromValue(value: unknown, context: McpContext): Record<string, unknown> {
        if (context.request.capability === McpCapability.Resource) return { contents: this.resourceContentsFromValue(value, context) };
        if (value === undefined || value === null) return this.fromContent([], undefined, context);
        if (typeof value === 'string') return this.fromContent([{ type: 'text', text: value }], undefined, context);
        if (value instanceof Uint8Array) {
            const resource = { uri: this.uriOf(context), mimeType: 'application/octet-stream', blob: toBase64(value) };
            return this.fromContent([{ type: 'resource', resource }], undefined, context);
        }

        const text = JSON.stringify(value) ?? String(value);
        return this.fromContent([{ type: 'text', text }], isPlainObject(value) ? value : undefined, context);
    }

    /**
     * Converts a list of content blocks.
     * @param content The content blocks.
     * @param structuredContent The structured content of a tool result.
     * @param context The context of the request.
     * @returns The MCP result.
     */
    public fromContent(content: McpContent[], structuredContent: Record<string, unknown> | undefined, context: McpContext): Record<string, unknown> {
        switch (context.request.capability) {
            case McpCapability.Prompt:
                return this.fromMessages(
                    content.map((block) => ({ role: 'user', content: block })),
                    undefined,
                    context
                );
            case McpCapability.Resource:
                return { contents: content.flatMap((block) => this.resourceContentsFromBlock(block, context)) };
            default:
                return structuredContent ? { content, structuredContent } : { content };
        }
    }

    /**
     * Converts a list of prompt messages.
     * @param messages The prompt messages.
     * @param description The description of the prompt result. Defaults to the description of the prompt.
     * @param context The context of the request.
     * @returns The MCP result.
     */
    public fromMessages(messages: McpPromptMessage[], description: string | undefined, context: McpContext): Record<string, unknown> {
        if (context.request.capability !== McpCapability.Prompt) {
            return this.fromContent(
                messages.map((message) => message.content),
                undefined,
                context
            );
        }

        const resultDescription = description ?? context.definition.description;
        return resultDescription ? { description: resultDescription, messages } : { messages };
    }

    private resourceContentsFromValue(value: unknown, context: McpContext): McpResourceContents[] {
        const uri = this.uriOf(context);
        const mimeType = 'mimeType' in context.definition ? context.definition.mimeType : undefined;

        if (value === undefined || value === null) return [];
        if (typeof value === 'string') return [{ uri, mimeType: mimeType ?? 'text/plain', text: value }];
        if (value instanceof Uint8Array) return [{ uri, mimeType: mimeType ?? 'application/octet-stream', blob: toBase64(value) }];
        return [{ uri, mimeType: mimeType ?? 'application/json', text: JSON.stringify(value) ?? String(value) }];
    }

    private resourceContentsFromBlock(block: McpContent, context: McpContext): McpResourceContents[] {
        const uri = this.uriOf(context);
        switch (block.type) {
            case 'text': {
                const mimeType = 'mimeType' in context.definition ? context.definition.mimeType : undefined;
                return [{ uri, mimeType: mimeType ?? 'text/plain', text: block.text }];
            }
            case 'image':
            case 'audio':
                return [{ uri, mimeType: block.mimeType, blob: block.data }];
            case 'resource':
                return [block.resource];
            default:
                return [];
        }
    }

    private uriOf(context: McpContext): string {
        return context.request.uri ?? `${context.request.capability}://${context.request.name}`;
    }
}

/**
 * A singleton instance of McpResultConverterStatic.
 */
export const McpResultConverter = new McpResultConverterStatic();
