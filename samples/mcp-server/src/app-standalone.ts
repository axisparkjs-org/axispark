import path from 'node:path';
import { AxiSparkFactory } from '@axisparkjs/core';
import { ConsoleTransport, LogLevel, SimpleFormatter } from '@axisparkjs/logger';
import { McpPlugin, McpPluginOptionsFactory } from '@axisparkjs/mcp';

export const app = AxiSparkFactory.create({
    name: 'MCP Server',
    basePath: path.join(__dirname, 'mcp'),
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
