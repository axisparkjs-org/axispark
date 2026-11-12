import { AxiSparkFactory } from '@axisparkjs/core';
import { HttpPlugin } from '@axisparkjs/http';
import { HttpPluginOptionsFactory } from '@axisparkjs/http-express';
import { ConsoleTransport, LogLevel, SimpleFormatter } from '@axisparkjs/logger';
import { RemoteConfigPlugin } from './remote-config.plugin';

export const app = AxiSparkFactory.create({
    name: 'Concurrent Resolutions App',
    basePath: __dirname,
    logTransports: [
        new ConsoleTransport({
            minLevel: LogLevel.Info,
            formatter: new SimpleFormatter()
        })
    ]
});

app.use(RemoteConfigPlugin);

app.use(
    HttpPlugin,
    HttpPluginOptionsFactory.create({
        basePath: '/api',
        port: 3000
    })
);
