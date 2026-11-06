import { AxiSparkFactory } from '@axisparkjs/core';
import { HttpPlugin } from '@axisparkjs/http';
import { HttpPluginOptionsFactory } from '@axisparkjs/http-fastify';
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
