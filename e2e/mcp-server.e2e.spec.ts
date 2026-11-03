import { AxiSparkTestFactory } from '@axisparkjs/test';
import { AxiSparkCore } from '@axisparkjs/core';
import { McpPlugin } from '@axisparkjs/mcp';
import { app as appStandalone } from '@axisparkjs/samples/mcp-server/src/app-standalone';
import { app as appExpress } from '@axisparkjs/samples/mcp-server/src/app-express';
import { app as appFastify } from '@axisparkjs/samples/mcp-server/src/app-fastify';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import path from 'node:path';

const textOf = (result: { content?: unknown }) => (result.content as { type: string; text: string }[])[0].text;

describe.each([
    { name: 'standalone', app: appStandalone, url: 'http://localhost:3000/mcp' },
    { name: 'Express', app: appExpress, url: 'http://localhost:3000/api/mcp' },
    { name: 'Fastify', app: appFastify, url: 'http://localhost:3000/api/mcp' }
])('MCP Server App ($name)', ({ app, url }) => {
    let axiSparkCore: AxiSparkCore;
    let client: Client;

    beforeAll(async () => {
        axiSparkCore = AxiSparkTestFactory.create({ app });
        await axiSparkCore.init();
        await axiSparkCore.run();

        client = new Client({ name: 'e2e-client', version: '1.0.0' });
        await client.connect(new StreamableHTTPClientTransport(new URL(url)));
    });

    it('should register the MCP plugin', () => {
        expect(axiSparkCore.used()).toEqual(
            expect.arrayContaining([{ type: McpPlugin, options: expect.objectContaining({ plugin: McpPlugin, transport: 'http' }) }])
        );
    });

    it('should send the server information', () => {
        expect(client.getServerVersion()).toEqual(expect.objectContaining({ name: 'Test', version: '1.0.0' }));
    });

    it('should list the tools with their input schemas', async () => {
        const { tools } = await client.listTools();

        expect(tools.map((tool) => tool.name).sort()).toEqual(['fail', 'pixel', 'slow', 'users.count', 'users.create', 'users.search', 'whoami']);
        expect(tools.find((tool) => tool.name === 'users.search')).toEqual(
            expect.objectContaining({
                description: 'Search users by name',
                annotations: { readOnlyHint: true },
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', minLength: 1, maxLength: 50 },
                        limit: { type: 'integer', minimum: 1, maximum: 100 }
                    },
                    required: ['query']
                }
            })
        );
        expect(tools.find((tool) => tool.name === 'users.count')?.inputSchema).toEqual({ type: 'object' });
    });

    it('should call a tool with validated arguments and return structured content', async () => {
        const result = await client.callTool({ name: 'users.search', arguments: { query: 'ada' } });

        expect(result.isError).toBeFalsy();
        expect(result.structuredContent).toEqual({ users: [{ id: '1', name: 'Ada Lovelace', email: 'ada@axispark.dev' }] });
        expect(JSON.parse(textOf(result))).toEqual(result.structuredContent);
    });

    it('should return a text result for a string', async () => {
        const result = await client.callTool({ name: 'users.count', arguments: {} });

        expect(textOf(result)).toMatch(/^There are \d+ users$/);
    });

    it('should return validation errors as tool errors and keep the server working', async () => {
        const invalid = await client.callTool({ name: 'users.create', arguments: { name: 'A', email: 'not-an-email', admin: true } });

        expect(invalid.isError).toBe(true);
        expect(textOf(invalid)).toContain('Validation failed');
        expect(textOf(invalid)).toContain('email must be an email');

        const valid = await client.callTool({ name: 'users.create', arguments: { name: 'Linus', email: 'linus@axispark.dev' } });
        expect(valid.isError).toBeFalsy();
        expect(valid.structuredContent).toEqual(expect.objectContaining({ name: 'Linus', email: 'linus@axispark.dev' }));
    });

    it('should return thrown errors and timeouts as tool errors', async () => {
        const failed = await client.callTool({ name: 'fail', arguments: {} });
        expect(failed).toEqual(expect.objectContaining({ isError: true, content: [{ type: 'text', text: 'Something went wrong' }] }));

        const slow = await client.callTool({ name: 'slow', arguments: {} });
        expect(slow).toEqual(expect.objectContaining({ isError: true, content: [{ type: 'text', text: 'Request timed out after 50ms' }] }));
    });

    it('should return content built with McpResults', async () => {
        const result = await client.callTool({ name: 'pixel', arguments: {} });

        expect(result.content).toEqual([{ type: 'image', mimeType: 'image/png', data: expect.any(String) }]);
    });

    it('should inject the session and the context', async () => {
        const result = await client.callTool({ name: 'whoami', arguments: {} });

        expect(result.structuredContent).toEqual(expect.objectContaining({ transport: 'http', tool: 'whoami' }));
    });

    it('should fail for an unknown tool', async () => {
        await expect(client.callTool({ name: 'unknown', arguments: {} })).rejects.toThrow("Tool 'unknown' not found");
    });

    it('should list the resources and the resource templates', async () => {
        const { resources } = await client.listResources();
        const { resourceTemplates } = await client.listResourceTemplates();

        expect(resources).toEqual([{ uri: 'users://all', name: 'users.all', description: 'All the users', mimeType: 'application/json' }]);
        expect(resourceTemplates).toEqual([{ uriTemplate: 'users://{id}', name: 'users.profile', description: 'User profile', mimeType: 'application/json' }]);
    });

    it('should read a resource from a URI template', async () => {
        const { contents } = await client.readResource({ uri: 'users://2' });

        expect(contents).toEqual([
            { uri: 'users://2', mimeType: 'application/json', text: JSON.stringify({ id: '2', name: 'Alan Turing', email: 'alan@axispark.dev' }) }
        ]);
    });

    it('should return resource errors as protocol errors', async () => {
        await expect(client.readResource({ uri: 'users://404' })).rejects.toThrow("User '404' not found");
        await expect(client.readResource({ uri: 'unknown://resource' })).rejects.toThrow("Resource 'unknown://resource' not found");
    });

    it('should list and get the prompts', async () => {
        const { prompts } = await client.listPrompts();
        expect(prompts).toEqual([
            {
                name: 'users.welcome',
                description: 'Write a welcome message for a new user',
                arguments: [
                    { name: 'name', required: true },
                    { name: 'tone', required: false }
                ]
            }
        ]);

        const prompt = await client.getPrompt({ name: 'users.welcome', arguments: { name: 'Ada', tone: 'formal' } });
        expect(prompt).toEqual(
            expect.objectContaining({
                description: 'Write a welcome message for a new user',
                messages: [{ role: 'user', content: { type: 'text', text: 'Write a formal welcome message for Ada.' } }]
            })
        );
    });

    afterAll(async () => {
        await client?.close();
        await axiSparkCore.destroy();
    });
});

describe('MCP Server App (Express routes)', () => {
    let axiSparkCore: AxiSparkCore;

    beforeAll(async () => {
        axiSparkCore = AxiSparkTestFactory.create({ app: appExpress });
        await axiSparkCore.init();
        await axiSparkCore.run();
    });

    it('should keep serving the other routes of the HTTP plugin', async () => {
        const response = await fetch('http://localhost:3000/api/unknown');

        expect(response.status).toBe(404);
    });

    afterAll(async () => {
        await axiSparkCore.destroy();
    });
});

describe('MCP Server App (stdio)', () => {
    let client: Client;

    beforeAll(async () => {
        client = new Client({ name: 'e2e-client', version: '1.0.0' });
        await client.connect(
            new StdioClientTransport({
                command: process.execPath,
                args: ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register', path.join(__dirname, '../samples/mcp-server/src/stdio.bootstrap.ts')],
                cwd: path.join(__dirname, '..'),
                env: { ...process.env, TS_NODE_TRANSPILE_ONLY: 'true' } as Record<string, string>,
                stderr: 'ignore'
            })
        );
    }, 30000);

    it('should list and call the tools through stdio', async () => {
        const { tools } = await client.listTools();
        expect(tools.map((tool) => tool.name)).toContain('users.search');

        const result = await client.callTool({ name: 'whoami', arguments: {} });
        expect(result.structuredContent).toEqual(expect.objectContaining({ transport: 'stdio', tool: 'whoami' }));
    });

    afterAll(async () => {
        await client?.close();
    });
});
