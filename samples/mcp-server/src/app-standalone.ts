import { AxiSparkFactory } from '@axisparkjs/core';
import { ConsoleTransport, LogLevel, SimpleFormatter } from '@axisparkjs/logger';
import { McpPlugin, McpPluginOptionsFactory } from '@axisparkjs/mcp';

export const app = AxiSparkFactory.create({
    name: 'MCP Server',
    basePath: __dirname,
    // The app files create applications when they are imported, so the scanner does not load them. The bootstrap files are excluded by default.
    scanner: { exclude: ['**/app-*.{js,ts}'] },
    logTransports: [
        new ConsoleTransport({
            minLevel: LogLevel.Info,
            formatter: new SimpleFormatter()
        })
    ]
});

app.use(
    McpPlugin,
    McpPluginOptionsFactory.create({
        transport: 'http',
        path: '/mcp',
        port: 3000,
        instructions: 'Use the users tools to search and create users.'
    })
);
