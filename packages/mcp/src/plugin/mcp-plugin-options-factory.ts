import { Factory } from '@axisparkjs/common';
import { McpPlugin } from './mcp-plugin';
import { McpPluginOptions } from './mcp-plugin-options';

/**
 * A factory class for creating default MCP plugin options. It provides a method to create an instance of McpPluginOptions with default values, allowing for optional overrides.
 */
export class McpPluginOptionsFactoryStatic implements Factory<McpPluginOptions> {
    create(options?: Partial<Omit<McpPluginOptions, 'plugin'>>): McpPluginOptions {
        return {
            plugin: McpPlugin,
            transport: 'http',
            path: '/mcp',
            useHttpPluginServer: false,
            port: 3000,
            ...options
        };
    }
}

export const McpPluginOptionsFactory = new McpPluginOptionsFactoryStatic();
