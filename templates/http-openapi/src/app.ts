import { AxiSparkFactory } from '@axisparkjs/core';
import { HttpPlugin } from '@axisparkjs/http';
import { HttpPluginOptionsFactory } from '@axisparkjs/http-express';
import { ConsoleTransport, LogLevel, SimpleFormatter } from '@axisparkjs/logger';
import { OpenApiPlugin, OpenApiPluginOptionsFactory } from '@axisparkjs/openapi';

export const app = AxiSparkFactory.create({
    name: 'HTTP OpenAPI Template',
    basePath: __dirname,
    logTransports: [
        new ConsoleTransport({
            minLevel: LogLevel.Debug,
            formatter: new SimpleFormatter()
        })
    ]
});
app.use(HttpPlugin, HttpPluginOptionsFactory.create({ basePath: '/api' }));
app.use(
    OpenApiPlugin,
    OpenApiPluginOptionsFactory.create({
        info: {
            title: 'Example API',
            version: '1.0.0',
            description: 'A small API documented with AxiSpark OpenAPI.'
        }
    })
);
