import { Inject, Injectable } from '@axisparkjs/di';
import { Logger } from '@axisparkjs/logger';
import { CLIENT_INFO_META_KEY, ProtocolError, ProtocolErrorCode, Server, ServerCapabilities, ServerContext } from '@modelcontextprotocol/server';
import { MCP_LOGGER } from '../di/tokens';
import { McpCapabilityDefinition, McpDefinitions, McpResourceDefinition } from '../definitions';
import { McpCapability, McpClientInfo, McpRequest, McpSession } from '../types';

/**
 * The information of the MCP server sent to the clients.
 */
export interface McpServerInfo {
    /** The name of the server. */
    name: string;
    /** The version of the server. */
    version: string;
    /** Instructions that describe how to use the server, which clients can add to the context of the model. */
    instructions?: string;
}

const EMPTY_RESULTS: Record<McpCapability, () => Record<string, unknown>> = {
    [McpCapability.Tool]: () => ({ content: [] }),
    [McpCapability.Resource]: () => ({ contents: [] }),
    [McpCapability.Prompt]: () => ({ messages: [] })
};

/**
 * A builder of the protocol servers of the MCP plugin. The transports create a server for each connection or request, and every server dispatches the requests to the handlers of the MCP definitions.
 */
@Injectable()
export class McpServerBuilder {
    private info: McpServerInfo;
    private definitions: McpDefinitions = { tools: [], resources: [], prompts: [] };

    constructor(@Inject(MCP_LOGGER) private readonly logger: Logger) {}

    /**
     * Configures the information and the capabilities of the servers created by the builder.
     * @param info The information of the server sent to the clients.
     * @param definitions The tools, resources and prompts of the application.
     */
    public configure(info: McpServerInfo, definitions: McpDefinitions): void {
        this.info = info;
        this.definitions = definitions;
    }

    /**
     * Creates a protocol server with the request handlers of the configured definitions. Only the capabilities with at least one definition are declared.
     * @param transport The transport that serves the server.
     * @returns The protocol server.
     */
    public build(transport: McpSession['transport']): Server {
        const { tools, resources, prompts } = this.definitions;
        const capabilities: ServerCapabilities = {};
        if (tools.length > 0) capabilities.tools = {};
        if (resources.length > 0) capabilities.resources = {};
        if (prompts.length > 0) capabilities.prompts = {};

        const server = new Server(
            { name: this.info.name, version: this.info.version },
            { capabilities, ...(this.info.instructions ? { instructions: this.info.instructions } : {}) }
        );

        if (capabilities.tools) this.registerTools(server, transport);
        if (capabilities.resources) this.registerResources(server, transport);
        if (capabilities.prompts) this.registerPrompts(server, transport);
        return server;
    }

    private registerTools(server: Server, transport: McpSession['transport']): void {
        server.setRequestHandler('tools/list', async () => ({
            tools: this.definitions.tools.map((tool) => ({
                name: tool.name,
                ...(tool.title ? { title: tool.title } : {}),
                ...(tool.description ? { description: tool.description } : {}),
                inputSchema: tool.inputSchema as any,
                ...(tool.annotations ? { annotations: tool.annotations } : {})
            }))
        }));

        server.setRequestHandler('tools/call', async (request, ctx) => {
            const { name, arguments: args, _meta } = request.params;
            const tool = this.definitions.tools.find((definition) => definition.name === name);
            if (!tool) throw new ProtocolError(ProtocolErrorCode.InvalidParams, `Tool '${name}' not found`);

            const mcpRequest = this.createRequest(McpCapability.Tool, name, ctx, { arguments: args ?? {}, meta: _meta });
            return (await this.execute(tool, mcpRequest, server, ctx, transport)) as any;
        });
    }

    private registerResources(server: Server, transport: McpSession['transport']): void {
        const describe = (resource: McpResourceDefinition) => ({
            name: resource.name,
            ...(resource.title ? { title: resource.title } : {}),
            ...(resource.description ? { description: resource.description } : {}),
            ...(resource.mimeType ? { mimeType: resource.mimeType } : {})
        });

        server.setRequestHandler('resources/list', async () => ({
            resources: this.definitions.resources.filter((resource) => !resource.isTemplate).map((resource) => ({ uri: resource.uri, ...describe(resource) }))
        }));

        server.setRequestHandler('resources/templates/list', async () => ({
            resourceTemplates: this.definitions.resources
                .filter((resource) => resource.isTemplate)
                .map((resource) => ({ uriTemplate: resource.uri, ...describe(resource) }))
        }));

        server.setRequestHandler('resources/read', async (request, ctx) => {
            const { uri, _meta } = request.params;
            const ordered = [
                ...this.definitions.resources.filter((resource) => !resource.isTemplate),
                ...this.definitions.resources.filter((resource) => resource.isTemplate)
            ];
            for (const resource of ordered) {
                const params = resource.match(uri);
                if (!params) continue;

                const mcpRequest = this.createRequest(McpCapability.Resource, resource.name, ctx, { uri, params, meta: _meta });
                return (await this.execute(resource, mcpRequest, server, ctx, transport)) as any;
            }
            throw new ProtocolError(ProtocolErrorCode.InvalidParams, `Resource '${uri}' not found`, { uri });
        });
    }

    private registerPrompts(server: Server, transport: McpSession['transport']): void {
        server.setRequestHandler('prompts/list', async () => ({
            prompts: this.definitions.prompts.map((prompt) => ({
                name: prompt.name,
                ...(prompt.title ? { title: prompt.title } : {}),
                ...(prompt.description ? { description: prompt.description } : {}),
                arguments: prompt.arguments
            }))
        }));

        server.setRequestHandler('prompts/get', async (request, ctx) => {
            const { name, arguments: args, _meta } = request.params;
            const prompt = this.definitions.prompts.find((definition) => definition.name === name);
            if (!prompt) throw new ProtocolError(ProtocolErrorCode.InvalidParams, `Prompt '${name}' not found`);

            const mcpRequest = this.createRequest(McpCapability.Prompt, name, ctx, { arguments: args ?? {}, meta: _meta });
            return (await this.execute(prompt, mcpRequest, server, ctx, transport)) as any;
        });
    }

    private createRequest(capability: McpCapability, name: string, ctx: ServerContext, values: Partial<McpRequest>): McpRequest {
        return {
            capability,
            name,
            arguments: {},
            params: {},
            signal: ctx.mcpReq.signal,
            ...values
        };
    }

    private async execute(
        definition: McpCapabilityDefinition,
        request: McpRequest,
        server: Server,
        ctx: ServerContext,
        transport: McpSession['transport']
    ): Promise<Record<string, unknown>> {
        let response;
        try {
            response = await definition.handler({ request, session: this.createSession(ctx, transport), client: this.getClient(server, ctx) });
        } catch (error) {
            await this.logger.error(`Unexpected error handling MCP ${request.capability} '${request.name}'`, error instanceof Error ? error : undefined);
            throw new ProtocolError(ProtocolErrorCode.InternalError, error instanceof Error ? error.message : String(error));
        }

        if (response?.error) throw new ProtocolError(response.error.code, response.error.message, response.error.options?.data);
        return response?.result ?? EMPTY_RESULTS[request.capability]();
    }

    private createSession(ctx: ServerContext, transport: McpSession['transport']): McpSession {
        const session: McpSession = { id: ctx.sessionId, transport };
        if (ctx.http?.authInfo) session.authInfo = ctx.http.authInfo as unknown as Record<string, unknown>;
        if (ctx.http?.req) session.headers = Object.fromEntries(ctx.http.req.headers.entries());
        return session;
    }

    private getClient(server: Server, ctx: ServerContext): McpClientInfo | undefined {
        const envelope = ctx.mcpReq.envelope as Record<string, unknown> | undefined;
        return (server.getClientVersion() ?? envelope?.[CLIENT_INFO_META_KEY]) as McpClientInfo | undefined;
    }
}
