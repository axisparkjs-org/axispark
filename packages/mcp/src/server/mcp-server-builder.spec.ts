import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { McpDefinitions, McpPromptDefinition, McpResourceDefinition, McpToolDefinition } from '../definitions';
import { McpError, McpErrorCode } from '../implementations';
import { McpServerBuilder } from './mcp-server-builder';

class Target {}

describe('McpServerBuilder', () => {
    const logger = { error: jest.fn() };
    let client: Client;

    const connect = async (definitions: McpDefinitions, instructions?: string) => {
        const builder = new McpServerBuilder(logger as any);
        builder.configure({ name: 'test', version: '2.0.0', instructions }, definitions);
        const server = builder.build('stdio');
        const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
        await server.connect(serverTransport);
        client = new Client({ name: 'client', version: '1.0.0' });
        await client.connect(clientTransport);
        return client;
    };

    const tool = (name: string, handler: jest.Mock, extra: Partial<McpToolDefinition> = {}) =>
        Object.assign(new McpToolDefinition(Target, name, name, undefined, undefined, { type: 'object' }, undefined, handler), extra);

    afterEach(async () => {
        await client?.close();
        jest.clearAllMocks();
    });

    it('should declare only the capabilities with definitions', async () => {
        await connect({ tools: [tool('a', jest.fn())], resources: [], prompts: [] }, 'Use it well');

        expect(client.getServerCapabilities()).toEqual(expect.objectContaining({ tools: {} }));
        expect(client.getServerCapabilities()?.resources).toBeUndefined();
        expect(client.getServerCapabilities()?.prompts).toBeUndefined();
        expect(client.getServerVersion()).toEqual(expect.objectContaining({ name: 'test', version: '2.0.0' }));
        expect(client.getInstructions()).toBe('Use it well');
    });

    it('should build a server without capabilities', async () => {
        await connect({ tools: [], resources: [], prompts: [] });

        expect(client.getServerCapabilities()?.tools).toBeUndefined();
    });

    it('should list and call the tools', async () => {
        const handler = jest.fn().mockResolvedValue({ result: { content: [{ type: 'text', text: 'ok' }] } });
        await connect({
            tools: [
                tool('search', handler, { title: 'Search', description: 'Search things', annotations: { readOnlyHint: true } }),
                tool('empty', jest.fn().mockResolvedValue(undefined))
            ],
            resources: [],
            prompts: []
        });

        expect((await client.listTools()).tools).toEqual([
            { name: 'search', title: 'Search', description: 'Search things', inputSchema: { type: 'object' }, annotations: { readOnlyHint: true } },
            { name: 'empty', inputSchema: { type: 'object' } }
        ]);
        expect(await client.callTool({ name: 'search', arguments: { q: 1 } })).toEqual(expect.objectContaining({ content: [{ type: 'text', text: 'ok' }] }));
        expect(handler).toHaveBeenCalledWith({
            request: expect.objectContaining({ capability: 'tool', name: 'search', arguments: { q: 1 }, params: {}, signal: expect.any(AbortSignal) }),
            session: { id: undefined, transport: 'stdio' },
            client: expect.objectContaining({ name: 'client', version: '1.0.0' })
        });
        expect(await client.callTool({ name: 'empty' })).toEqual(expect.objectContaining({ content: [] }));
        await expect(client.callTool({ name: 'missing', arguments: {} })).rejects.toThrow("Tool 'missing' not found");
    });

    it('should return the errors of the handlers as protocol errors', async () => {
        await connect({
            tools: [
                tool('error', jest.fn().mockResolvedValue({ error: new McpError('Invalid', McpErrorCode.InvalidParams, { data: { field: 'a' } }) })),
                tool('throw', jest.fn().mockRejectedValue(new Error('Unexpected')))
            ],
            resources: [],
            prompts: []
        });

        await expect(client.callTool({ name: 'error', arguments: {} })).rejects.toMatchObject({
            code: McpErrorCode.InvalidParams,
            message: expect.stringContaining('Invalid')
        });
        await expect(client.callTool({ name: 'throw', arguments: {} })).rejects.toMatchObject({
            code: McpErrorCode.InternalError,
            message: expect.stringContaining('Unexpected')
        });
        expect(logger.error).toHaveBeenCalledWith("Unexpected error handling MCP tool 'throw'", expect.any(Error));
    });

    it('should log and convert values thrown by the handlers that are not errors', async () => {
        await connect({ tools: [tool('reject', jest.fn().mockRejectedValue('plain'))], resources: [], prompts: [] });

        await expect(client.callTool({ name: 'reject', arguments: {} })).rejects.toMatchObject({ message: expect.stringContaining('plain') });
        expect(logger.error).toHaveBeenCalledWith("Unexpected error handling MCP tool 'reject'", undefined);
    });

    it('should create the session and the client from the HTTP request and the request envelope', () => {
        const builder = new McpServerBuilder(logger as any) as any;
        const ctx = {
            sessionId: 'session',
            http: { authInfo: { token: 't' }, req: new Request('http://localhost/mcp', { headers: { 'x-tenant': 'acme' } }) },
            mcpReq: { envelope: { 'io.modelcontextprotocol/clientInfo': { name: 'modern', version: '2.0.0' } } }
        };

        expect(builder.createSession(ctx, 'http')).toEqual({ id: 'session', transport: 'http', authInfo: { token: 't' }, headers: { 'x-tenant': 'acme' } });
        expect(builder.getClient({ getClientVersion: () => undefined }, ctx)).toEqual({ name: 'modern', version: '2.0.0' });
        expect(builder.getClient({ getClientVersion: () => undefined }, { mcpReq: {} })).toBeUndefined();
    });

    it('should list and read the resources', async () => {
        const fixed = jest.fn().mockResolvedValue({ result: { contents: [{ uri: 'config://app', text: 'config' }] } });
        const template = jest.fn().mockResolvedValue(undefined);
        await connect({
            tools: [],
            resources: [
                new McpResourceDefinition(Target, 'profile', 'users://{id}', 'profile', 'User', 'Profile', 'application/json', template),
                new McpResourceDefinition(Target, 'config', 'config://app', 'config', undefined, undefined, undefined, fixed)
            ],
            prompts: []
        });

        expect((await client.listResources()).resources).toEqual([{ uri: 'config://app', name: 'config' }]);
        expect((await client.listResourceTemplates()).resourceTemplates).toEqual([
            { uriTemplate: 'users://{id}', name: 'profile', title: 'Profile', description: 'User', mimeType: 'application/json' }
        ]);
        expect((await client.readResource({ uri: 'config://app' })).contents).toEqual([{ uri: 'config://app', text: 'config' }]);
        expect((await client.readResource({ uri: 'users://7' })).contents).toEqual([]);
        expect(template).toHaveBeenCalledWith(
            expect.objectContaining({ request: expect.objectContaining({ capability: 'resource', uri: 'users://7', params: { id: '7' } }) })
        );
        await expect(client.readResource({ uri: 'other://1' })).rejects.toThrow("Resource 'other://1' not found");
    });

    it('should list and get the prompts', async () => {
        const handler = jest.fn().mockResolvedValue({ result: { messages: [{ role: 'user', content: { type: 'text', text: 'hi' } }] } });
        await connect({
            tools: [],
            resources: [],
            prompts: [
                new McpPromptDefinition(Target, 'welcome', 'welcome', 'Welcome', 'Welcome title', [{ name: 'name', required: true }], handler),
                new McpPromptDefinition(Target, 'plain', 'plain', undefined, undefined, [], jest.fn().mockResolvedValue(undefined))
            ]
        });

        expect((await client.listPrompts()).prompts).toEqual([
            { name: 'welcome', title: 'Welcome title', description: 'Welcome', arguments: [{ name: 'name', required: true }] },
            { name: 'plain', arguments: [] }
        ]);
        expect((await client.getPrompt({ name: 'welcome', arguments: { name: 'Ada' } })).messages).toEqual([
            { role: 'user', content: { type: 'text', text: 'hi' } }
        ]);
        expect(handler).toHaveBeenCalledWith(
            expect.objectContaining({ request: expect.objectContaining({ capability: 'prompt', arguments: { name: 'Ada' } }) })
        );
        expect((await client.getPrompt({ name: 'plain' })).messages).toEqual([]);
        await expect(client.getPrompt({ name: 'missing' })).rejects.toThrow("Prompt 'missing' not found");
    });
});
