import { HTTP_ADAPTER, HTTP_OPTIONS } from '@axisparkjs/http';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { McpDefinitionGenerator } from '../definitions';
import { MCP_DEFINITIONS, MCP_LOGGER, MCP_OPTIONS, MCP_SERVER, MCP_TRANSPORT } from '../di';
import { McpServerBuilder } from '../server';
import { McpHttpTransport, McpStdioTransport } from '../transports';
import { McpPlugin } from './mcp-plugin';
import { McpPluginOptions } from './mcp-plugin-options';

describe('McpPlugin', () => {
    const definitions = {
        tools: [{ name: 't', target: class T {} }],
        resources: [{ uri: 'r://1', target: class R {} }],
        prompts: [{ name: 'p', target: class P {} }]
    };
    let directory: string;

    const createPlugin = (
        options: Partial<McpPluginOptions> = {},
        config: Record<string, unknown> = {},
        http = true,
        httpOptions: Record<string, unknown> = { port: 8080, basePath: '/api' }
    ) => {
        const builder = { configure: jest.fn(), build: jest.fn() };
        const container = { bind: jest.fn() };
        const logger = { child: jest.fn().mockReturnThis(), info: jest.fn(), debug: jest.fn(), error: jest.fn() };
        const httpServer = { listeners: jest.fn().mockReturnValue([]), removeAllListeners: jest.fn(), on: jest.fn(), removeListener: jest.fn() };
        const injector = {
            get: jest.fn(async (token: unknown) => {
                if (token === HTTP_OPTIONS) {
                    if (!http) throw new Error('not bound');
                    return httpOptions;
                }
                if (token === HTTP_ADAPTER) return { getHttpServer: () => httpServer };
                if (token === McpDefinitionGenerator) return { generate: async () => definitions };
                if (token === McpServerBuilder) return builder;
                return {};
            })
        };
        const plugin = new McpPlugin(logger as any, injector as any);
        const context = { container, config: { name: 'App', basePath: directory, ...config } };
        return { plugin, builder, container, logger, context, options: { plugin: McpPlugin, transport: 'http', ...options } as McpPluginOptions };
    };

    const bound = (container: { bind: jest.Mock }, token: unknown) => container.bind.mock.calls.find(([binding]) => binding.token === token)?.[0].useValue;

    beforeEach(() => {
        directory = mkdtempSync(join(tmpdir(), 'mcp-plugin-'));
    });

    afterEach(() => {
        rmSync(directory, { recursive: true, force: true });
    });

    it('should require options', async () => {
        await expect(createPlugin().plugin.onRegister({} as any)).rejects.toThrow('McpPlugin added without configuration');
    });

    it('should register the bindings and a standalone HTTP transport', async () => {
        writeFileSync(join(directory, 'package.json'), JSON.stringify({ version: '3.2.1' }));
        const test = createPlugin({ timeout: 1000, instructions: 'Instructions' });

        await test.plugin.onRegister(test.context as any, test.options);

        expect(bound(test.container, MCP_OPTIONS)).toBe(test.options);
        expect(bound(test.container, MCP_LOGGER)).toBe(test.logger);
        expect(bound(test.container, MCP_DEFINITIONS)).toBe(definitions);
        expect(bound(test.container, MCP_SERVER)).toBe(test.builder);
        expect(test.builder.configure).toHaveBeenCalledWith({ name: 'App', version: '3.2.1', instructions: 'Instructions' }, definitions);

        const transport = bound(test.container, MCP_TRANSPORT);
        expect(transport).toBeInstanceOf(McpHttpTransport);
        expect(transport.endpoint).toBe('/mcp');
        transport.provider();
        expect(test.builder.build).toHaveBeenCalledWith('http');
        expect(test.logger.debug).toHaveBeenCalledWith('Registered tool t for T');
        expect(test.logger.debug).toHaveBeenCalledWith('Registered resource r://1 for R');
        expect(test.logger.debug).toHaveBeenCalledWith('Registered prompt p for P');
    });

    it('should start and stop the transport', async () => {
        const test = createPlugin({ name: 'Custom', version: '9.0.0', port: 4567 });
        await test.plugin.onRegister(test.context as any, test.options);
        const transport = bound(test.container, MCP_TRANSPORT);
        const start = jest.spyOn(transport, 'start').mockResolvedValue(undefined);
        const stop = jest.spyOn(transport, 'stop').mockResolvedValue(undefined);

        await test.plugin.onStart();
        await test.plugin.onStop();

        expect(test.builder.configure).toHaveBeenCalledWith({ name: 'Custom', version: '9.0.0' }, definitions);
        expect(start).toHaveBeenCalled();
        expect(stop).toHaveBeenCalled();
        expect(test.logger.info).toHaveBeenCalledWith('Plugin started. MCP server listening with the http transport at /mcp on port 4567');
    });

    it('should stop without a transport', async () => {
        const test = createPlugin();

        await expect(test.plugin.onStop()).resolves.toBeUndefined();
    });

    it('should mount the endpoint on the HTTP plugin server with its base path', async () => {
        const test = createPlugin({ useHttpPluginServer: true, path: 'mcp' });
        await test.plugin.onRegister(test.context as any, test.options);
        const transport = bound(test.container, MCP_TRANSPORT);
        jest.spyOn(transport, 'start').mockResolvedValue(undefined);

        await test.plugin.onStart();

        expect(transport.endpoint).toBe('/api/mcp');
        expect(test.logger.info).toHaveBeenCalledWith('Plugin started. MCP server listening with the http transport at /api/mcp on the HTTP plugin port 8080');
    });

    it('should mount the endpoint on the HTTP plugin server without a base path', async () => {
        const test = createPlugin({ useHttpPluginServer: true }, {}, true, { port: 8080 });
        await test.plugin.onRegister(test.context as any, test.options);

        expect(bound(test.container, MCP_TRANSPORT).endpoint).toBe('/mcp');
    });

    it('should fail when the HTTP plugin server is requested without the HTTP plugin', async () => {
        const test = createPlugin({ useHttpPluginServer: true }, {}, false);

        await expect(test.plugin.onRegister(test.context as any, test.options)).rejects.toThrow('the HttpPlugin is not registered');
    });

    it('should create a stdio transport', async () => {
        const test = createPlugin({ transport: 'stdio' });
        await test.plugin.onRegister(test.context as any, test.options);
        const transport = bound(test.container, MCP_TRANSPORT);

        expect(transport).toBeInstanceOf(McpStdioTransport);
        transport.provider();
        transport.onError(new Error('transport'));
        expect(test.builder.build).toHaveBeenCalledWith('stdio');
        expect(test.logger.error).toHaveBeenCalledWith('MCP transport error', expect.any(Error));
    });

    it('should default the version when the package.json has no valid version', async () => {
        writeFileSync(join(directory, 'package.json'), JSON.stringify({ version: 1 }));
        const invalid = createPlugin();
        await invalid.plugin.onRegister(invalid.context as any, invalid.options);
        expect(invalid.builder.configure).toHaveBeenCalledWith({ name: 'App', version: '1.0.0' }, definitions);

        writeFileSync(join(directory, 'package.json'), '{ not json');
        const malformed = createPlugin();
        await malformed.plugin.onRegister(malformed.context as any, malformed.options);
        expect(malformed.builder.configure).toHaveBeenCalledWith({ name: 'App', version: '1.0.0' }, definitions);
    });

    it('should search the package.json in the parent directories and default to the working directory', async () => {
        const nested = join(directory, 'src', 'app');
        mkdirSync(nested, { recursive: true });
        writeFileSync(join(directory, 'package.json'), JSON.stringify({ version: '4.0.0' }));
        const test = createPlugin({}, { basePath: nested });
        await test.plugin.onRegister(test.context as any, test.options);
        expect(test.builder.configure).toHaveBeenCalledWith({ name: 'App', version: '4.0.0' }, definitions);

        const root = createPlugin({}, { basePath: '/' });
        await root.plugin.onRegister(root.context as any, root.options);
        expect(root.builder.configure).toHaveBeenCalledWith(expect.objectContaining({ version: expect.any(String) }), definitions);

        const cwd = createPlugin({}, { basePath: undefined });
        await cwd.plugin.onRegister(cwd.context as any, cwd.options);
        expect(cwd.builder.configure).toHaveBeenCalledWith(expect.objectContaining({ version: expect.any(String) }), definitions);
    });
});
