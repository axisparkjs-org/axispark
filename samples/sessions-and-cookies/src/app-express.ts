import { AxiSparkFactory } from '@axisparkjs/core';
import { HttpPlugin } from '@axisparkjs/http';
import { HttpPluginOptionsFactory } from '@axisparkjs/http-express';
import { ConsoleTransport, LogLevel, SimpleFormatter } from '@axisparkjs/logger';

export const app = AxiSparkFactory.create({
    name: 'Sessions and Cookies',
    basePath: __dirname,
    settings: {
        envFiles: ['.env'],
        load: (env) => ({
            // The default value keeps the sample running without a .env file. Set your own secret in production.
            sessionSecret: env.string('SESSION_SECRET', { default: 'secretwithatleast32characters!!!', minLength: 32 }),
            cookieSecret: env.string('COOKIE_SECRET', { default: 'secretwithatleast32characters!!!', minLength: 32 })
        })
    },
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
        session: true,
        sessionOptions: {
            secret: app.settings.sessionSecret,
            resave: false,
            saveUninitialized: true
        },
        cookies: true,
        cookiesOptions: {
            secret: app.settings.cookieSecret
        }
    })
);
