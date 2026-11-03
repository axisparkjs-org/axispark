/**
 * The contents of a resource: a text or a binary blob encoded in base64.
 */
export type McpResourceContents = { uri: string; mimeType?: string; text: string } | { uri: string; mimeType?: string; blob: string };

/**
 * A content block of a tool result or a prompt message.
 */
export type McpContent =
    | { type: 'text'; text: string }
    | { type: 'image'; data: string; mimeType: string }
    | { type: 'audio'; data: string; mimeType: string }
    | { type: 'resource'; resource: McpResourceContents }
    | { type: 'resource_link'; uri: string; name: string; title?: string; description?: string; mimeType?: string };

/**
 * A message of a prompt.
 */
export interface McpPromptMessage {
    role: 'user' | 'assistant';
    content: McpContent;
}
