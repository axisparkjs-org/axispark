import { AxiSparkFactory } from '@axisparkjs/core';
import { LogLevel, SimpleFormatter, StreamTransport } from '@axisparkjs/logger';
import { McpPlugin, McpPluginOptionsFactory } from '@axisparkjs/mcp';

// With the stdio transport the standard output belongs to the protocol, so the logs go to stderr and the banner is disabled.
export const app = AxiSparkFactory.create({
    name: 'MCP Server',
    basePath: __dirname,
    // The app files create applications when they are imported, so the scanner does not load them. The bootstrap files are excluded by default.
    scanner: { exclude: ['**/app-*.{js,ts}'] },
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
