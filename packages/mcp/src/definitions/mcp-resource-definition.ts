import { ClassType } from '@axisparkjs/common';
import { UriTemplate } from '@modelcontextprotocol/server';
import { McpHandler } from './mcp-handler';

/**
 * A class representing the definition of an MCP resource, with a fixed URI or a URI template.
 */
export class McpResourceDefinition {
    private readonly template?: UriTemplate;

    constructor(
        public readonly target: ClassType,
        public readonly propertyKey: string | symbol,
        public readonly uri: string,
        public readonly name: string,
        public readonly description: string | undefined,
        public readonly title: string | undefined,
        public readonly mimeType: string | undefined,
        public readonly handler: McpHandler
    ) {
        if (UriTemplate.isTemplate(uri)) this.template = new UriTemplate(uri);
    }

    /**
     * Whether the URI of the resource is a URI template, such as `users://{id}`.
     */
    get isTemplate(): boolean {
        return this.template !== undefined;
    }

    /**
     * Matches a URI requested by a client against the URI of the resource.
     * @param uri The requested URI.
     * @returns The variables of the URI template, an empty object for a fixed URI that matches, or undefined when the URI does not match.
     */
    match(uri: string): Record<string, string | string[]> | undefined {
        if (!this.template) return uri === this.uri ? {} : undefined;
        return this.template.match(uri) ?? undefined;
    }
}
