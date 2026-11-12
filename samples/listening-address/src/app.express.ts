import { AxiSparkFactory } from '@axisparkjs/core';
import { HttpPlugin } from '@axisparkjs/http';
import { HttpPluginOptionsFactory } from '@axisparkjs/http-express';
import { ConsoleTransport, LogLevel, SimpleFormatter } from '@axisparkjs/logger';

export const createApp = (host?: string) => {
    const app = AxiSparkFactory.create({
        name: 'Listening Address Express App',
        basePath: __dirname,
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
            port: 4101,
            host
        })
    );

    return app;
};
