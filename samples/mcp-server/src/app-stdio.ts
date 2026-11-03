import path from 'node:path';
import { AxiSparkFactory } from '@axisparkjs/core';
import { LogLevel, SimpleFormatter, StreamTransport } from '@axisparkjs/logger';
import { McpPlugin, McpPluginOptionsFactory } from '@axisparkjs/mcp';

// The scanner only loads the MCP classes in ./mcp, so the bootstrap files are not imported.
// With the stdio transport the standard output belongs to the protocol, so the logs go to stderr and the banner is disabled.
export const app = AxiSparkFactory.create({
    name: 'MCP Server',
    basePath: path.join(__dirname, 'mcp'),
    banner: false,
    logTransports: [
        new StreamTransport({
            stream: process.stderr,
            minLevel: LogLevel.Info,
            formatter: new SimpleFormatter()
        })
    ]
});

app.use(McpPlugin, McpPluginOptionsFactory.create({ transport: 'stdio' }));
