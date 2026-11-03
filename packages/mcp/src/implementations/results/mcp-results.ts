import { McpError } from '../errors';
import { McpContent, McpPromptMessage } from './mcp-content';
import { ContentMcpResult, ErrorMcpResult, MessagesMcpResult, OkMcpResult, RawMcpResult } from './mcp-result';
import { toBase64 } from './mcp-result-converter';

/**
 * A static class for creating MCP results.
 */
export class McpResultsStatic {
    /**
     * Creates a result from any value. It is converted as if the handler returned it.
     */
    public Ok(value: unknown) {
        return new OkMcpResult(value);
    }
    /**
     * Creates a text result.
     */
    public Text(text: string) {
        return new ContentMcpResult({ content: [{ type: 'text', text }] });
    }
    /**
     * Creates a JSON result. Tools also send the value as structured content when it is an object.
     */
    public Json(value: unknown) {
        const structuredContent = typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
        return new ContentMcpResult({ content: [{ type: 'text', text: JSON.stringify(value) ?? String(value) }], structuredContent });
    }
    /**
     * Creates an image result.
     * @param data The image data, or a string already encoded in base64.
     * @param mimeType The MIME type of the image, such as `image/png`.
     */
    public Image(data: string | Uint8Array, mimeType: string) {
        return new ContentMcpResult({ content: [{ type: 'image', data: toBase64(data), mimeType }] });
    }
    /**
     * Creates an audio result.
     * @param data The audio data, or a string already encoded in base64.
     * @param mimeType The MIME type of the audio, such as `audio/wav`.
     */
    public Audio(data: string | Uint8Array, mimeType: string) {
        return new ContentMcpResult({ content: [{ type: 'audio', data: toBase64(data), mimeType }] });
    }
    /**
     * Creates a result with an embedded resource.
     * @param uri The URI of the resource.
     * @param contents The text or the binary contents of the resource.
     * @param mimeType The MIME type of the resource.
     */
    public Resource(uri: string, contents: string | Uint8Array, mimeType?: string) {
        const resource = typeof contents === 'string' ? { uri, mimeType, text: contents } : { uri, mimeType, blob: toBase64(contents) };
        return new ContentMcpResult({ content: [{ type: 'resource', resource }] });
    }
    /**
     * Creates a result with a link to a resource that the client can read later.
     * @param uri The URI of the resource.
     * @param name The name of the resource.
     * @param options The title, description and MIME type of the resource.
     */
    public ResourceLink(uri: string, name: string, options: { title?: string; description?: string; mimeType?: string } = {}) {
        return new ContentMcpResult({ content: [{ type: 'resource_link', uri, name, ...options }] });
    }
    /**
     * Creates a result from a list of content blocks.
     * @param content The content blocks.
     * @param structuredContent The structured content of a tool result.
     */
    public Content(content: McpContent[], structuredContent?: Record<string, unknown>) {
        return new ContentMcpResult({ content, structuredContent });
    }
    /**
     * Creates a prompt result from a list of messages.
     * @param messages The prompt messages.
     * @param description The description of the prompt result.
     */
    public Messages(messages: McpPromptMessage[], description?: string) {
        return new MessagesMcpResult({ messages, description });
    }
    /**
     * Creates a result that is sent to the client as it is.
     * @param result The MCP result, such as `{ content: [...] }` for a tool.
     */
    public Raw(result: Record<string, unknown>) {
        return new RawMcpResult(result);
    }
    /**
     * Creates an error result.
     * @param error The error or its message.
     */
    public Error(error: McpError | string) {
        return new ErrorMcpResult(typeof error === 'string' ? new McpError(error) : error);
    }
}

/**
 * A singleton instance of McpResultsStatic for creating MCP results.
 */
export const McpResults = new McpResultsStatic();
