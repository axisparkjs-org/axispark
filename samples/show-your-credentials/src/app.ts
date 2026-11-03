import { AxiSparkFactory } from '@axisparkjs/core';
import { HttpPlugin } from '@axisparkjs/http';
import { HttpPluginOptionsFactory } from '@axisparkjs/http-express';
import { ConsoleTransport, LogLevel, SimpleFormatter } from '@axisparkjs/logger';
import { SecurityPlugin, SecurityPluginOptionsFactory } from '@axisparkjs/security';
import { AppJwtAuthenticator, ClientApiKeyAuthenticator, UserBasicAuthenticator } from './authenticators';
import './controllers/credentials.controller';
import './security-error.filter';

export const app = AxiSparkFactory.create({
    name: 'Show Your Credentials App',
    basePath: __dirname,
    logTransports: [
        new ConsoleTransport({
            minLevel: LogLevel.Error,
            formatter: new SimpleFormatter()
        })
    ]
});

app.use(HttpPlugin, HttpPluginOptionsFactory.create({ basePath: '/api', port: 0 }));
app.use(
    SecurityPlugin,
    SecurityPluginOptionsFactory.create({
        authenticator: {
            strategy: 'selected',
            // Run in order: the first authenticator that returns a principal wins.
            selected: [AppJwtAuthenticator, UserBasicAuthenticator, ClientApiKeyAuthenticator]
        }
    })
);
