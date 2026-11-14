import { AxiSparkFactory } from '@axisparkjs/core';
import { HttpPlugin } from '@axisparkjs/http';
import { HttpPluginOptionsFactory } from '@axisparkjs/http-express';
import { ConsoleTransport, LogLevel, SimpleFormatter } from '@axisparkjs/logger';
import { loadSettings } from './settings';

export const app = AxiSparkFactory.create({
    name: 'HTTP Template',
    basePath: __dirname,
    settings: {
        envFiles: ['.env'],
        load: loadSettings
    },
    logTransports: [
        new ConsoleTransport({
            minLevel: LogLevel.Debug,
            formatter: new SimpleFormatter()
        })
    ]
});
app.use(
    HttpPlugin,
    HttpPluginOptionsFactory.create({
        port: app.settings.port,
        basePath: '/api'
    })
);
