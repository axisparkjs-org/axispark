import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { Server } from '@modelcontextprotocol/server';
import { createServer, Server as NodeHttpServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { McpHttpTransport, normalizeMcpPath } from './mcp-http-transport';

const buildServer = () => {
    const server = new Server({ name: 'test', version: '1.0.0' }, { capabilities: { tools: {} } });
    server.setRequestHandler('tools/list', async () => ({ tools: [{ name: 'ping', inputSchema: { type: 'object' } }] }));
    return server;
};

const listTools = async (url: string) => {
    const client = new Client({ name: 'client', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(url)));
    try {
        return (await client.listTools()).tools.map((tool) => tool.name);
    } finally {
        await client.close();
    }
};

const listen = (server: NodeHttpServer) => new Promise<number>((resolve) => server.listen(0, () => resolve((server.address() as AddressInfo).port)));

describe('normalizeMcpPath', () => {
    it('should add a leading slash and remove duplicated and trailing slashes', () => {
        expect(normalizeMcpPath('mcp')).toBe('/mcp');
        expect(normalizeMcpPath('//api//mcp/')).toBe('/api/mcp');
        expect(normalizeMcpPath('/')).toBe('/');
        expect(normalizeMcpPath('')).toBe('/');
    });
});

describe('McpHttpTransport', () => {
    it('should serve the endpoint on its own server and answer 404 on other paths', async () => {
        const transport = new McpHttpTransport(buildServer, { path: 'mcp/', port: 0 });
        expect(transport.endpoint).toBe('/mcp');
        await transport.start();
        const port = ((transport as any).ownServer.address() as AddressInfo).port;

        expect(await listTools(`http://localhost:${port}/mcp?x=1`)).toEqual(['ping']);
        const notFound = await fetch(`http://localhost:${port}/other`);
        expect(notFound.status).toBe(404);
        expect(await notFound.json()).toEqual({ error: 'Not Found' });

        await transport.stop();
        await transport.stop();
        await expect(fetch(`http://localhost:${port}/mcp`)).rejects.toThrow();
    });

    it('should reject the start when the port is in use', async () => {
        const blocker = createServer();
        const port = await listen(blocker);
        const transport = new McpHttpTransport(buildServer, { path: '/mcp', port });

        await expect(transport.start()).rejects.toThrow('EADDRINUSE');
        await new Promise((resolve) => blocker.close(resolve));
    });

    it('should mount the endpoint on an existing server and keep its listeners', async () => {
        const server = createServer((_req, res) => {
            res.writeHead(200).end('original');
        });
        const port = await listen(server);
        const transport = new McpHttpTransport(buildServer, { path: '/api/mcp', server });

        await transport.start();
        expect(server.listeners('request')).toHaveLength(1);
        expect(await listTools(`http://localhost:${port}/api/mcp`)).toEqual(['ping']);
        expect(await (await fetch(`http://localhost:${port}/api/users`)).text()).toBe('original');

        await transport.stop();
        const unmounted = await fetch(`http://localhost:${port}/api/mcp`);
        expect(await unmounted.text()).toBe('original');
        await new Promise((resolve) => server.close(resolve));
    });

    it('should validate the Host and Origin headers', async () => {
        const transport = new McpHttpTransport(buildServer, { path: '/mcp', port: 0, allowedHosts: ['allowed.test'], allowedOrigins: ['allowed.test'] });
        await transport.start();
        const port = ((transport as any).ownServer.address() as AddressInfo).port;

        const response = await fetch(`http://localhost:${port}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
        expect(response.status).toBe(403);

        await transport.stop();
    });

    it('should answer 503 when a request arrives before the start or after the stop', () => {
        const transport = new McpHttpTransport(buildServer, { path: '/mcp' });
        const res = { writeHead: jest.fn().mockReturnThis(), end: jest.fn() };

        expect((transport as any).handle({ url: '/mcp' }, res)).toBe(true);
        expect(res.writeHead).toHaveBeenCalledWith(503, { 'Content-Type': 'application/json' });
        expect((transport as any).handle({}, res)).toBe(false);
    });
});
