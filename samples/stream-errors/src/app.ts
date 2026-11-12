import { AxiSparkFactory } from '@axisparkjs/core';
import { HttpPlugin } from '@axisparkjs/http';
import { HttpPluginOptionsFactory as ExpressHttpPluginOptionsFactory } from '@axisparkjs/http-express';
import { HttpPluginOptionsFactory as FastifyHttpPluginOptionsFactory } from '@axisparkjs/http-fastify';
import { ConsoleTransport, LogLevel, SimpleFormatter } from '@axisparkjs/logger';

export type AdapterName = 'express' | 'fastify';

export const createApp = (adapter: AdapterName, port: number) => {
    const app = AxiSparkFactory.create({
        name: `Stream Errors App (${adapter})`,
        basePath: __dirname,
        logTransports: [
            new ConsoleTransport({
                minLevel: LogLevel.Info,
                formatter: new SimpleFormatter()
            })
        ]
    });

    const optionsFactory = adapter === 'express' ? ExpressHttpPluginOptionsFactory : FastifyHttpPluginOptionsFactory;
    app.use(HttpPlugin, optionsFactory.create({ basePath: '/api', port }));

    return app;
};
