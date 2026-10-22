import { AxiSparkFactory } from '@axisparkjs/core';
import { HttpPlugin } from '@axisparkjs/http';
import { HttpPluginOptionsFactory } from '@axisparkjs/http-fastify';

export const app = AxiSparkFactory.create({
    name: 'Host Routing',
    basePath: __dirname,
    banner: false
});

app.use(
    HttpPlugin,
    HttpPluginOptionsFactory.create({
        basePath: '/api',
        port: 0,
        timeout: false,
        logErrors: false
    })
);
