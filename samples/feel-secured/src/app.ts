import { AxiSparkFactory } from '@axisparkjs/core';
import { HttpPlugin } from '@axisparkjs/http';
import { HttpPluginOptionsFactory } from '@axisparkjs/http-fastify';
import { ConsoleTransport, LogLevel, SimpleFormatter } from '@axisparkjs/logger';
import { SecurityPlugin, SecurityPluginOptionsFactory } from '@axisparkjs/security';
import { TokenAuthenticator } from './authenticator';
import './controllers/access.controller';
import './controllers/document.controller';
import './security-error.filter';

export const app = AxiSparkFactory.create({
    name: 'Feel Secured App',
    basePath: __dirname,
    logTransports: [
        new ConsoleTransport({
            minLevel: LogLevel.Error,
            formatter: new SimpleFormatter()
        })
    ]
});

app.use(HttpPlugin, HttpPluginOptionsFactory.create({ basePath: '/api', port: 3000 }));
app.use(
    SecurityPlugin,
    SecurityPluginOptionsFactory.create({
        authenticator: {
            strategy: 'selected',
            selected: [TokenAuthenticator]
        }
    })
);
