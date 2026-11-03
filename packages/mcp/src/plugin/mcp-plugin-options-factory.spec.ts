import { McpPlugin } from './mcp-plugin';
import { McpPluginOptionsFactory } from './mcp-plugin-options-factory';

describe('McpPluginOptionsFactory', () => {
    it('should create defaults and apply overrides', () => {
        expect(McpPluginOptionsFactory.create()).toEqual({ plugin: McpPlugin, transport: 'http', path: '/mcp', useHttpPluginServer: false, port: 3000 });
        expect(McpPluginOptionsFactory.create({ transport: 'stdio', port: 9 })).toMatchObject({ transport: 'stdio', port: 9 });
    });
});
