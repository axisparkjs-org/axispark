import path from 'node:path';
import { AxiSparkFactory } from '@axisparkjs/core';
import { HttpPlugin } from '@axisparkjs/http';
import { HttpPluginOptionsFactory } from '@axisparkjs/http-fastify';
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
    HttpPlugin,
    HttpPluginOptionsFactory.create({
        basePath: '/api',
        port: 3000
    })
);
app.use(
    McpPlugin,
    McpPluginOptionsFactory.create({
        transport: 'http',
        path: '/mcp',
        useHttpPluginServer: true
    })
);
