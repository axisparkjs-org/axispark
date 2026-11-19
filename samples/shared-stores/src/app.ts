import { AxiSparkFactory } from '@axisparkjs/core';
import { HttpPlugin } from '@axisparkjs/http';
import { HttpPluginOptionsFactory } from '@axisparkjs/http-express';
import { ConsoleTransport, LogLevel, SimpleFormatter } from '@axisparkjs/logger';
import { RedisPlugin, RedisPluginOptionsFactory, RedisStore } from '@axisparkjs/redis';
import { SchedulePlugin, SchedulePluginOptionsFactory } from '@axisparkjs/schedule';

/**
 * Creates one instance of the application. Every instance connects to the same Redis database, so the rate limits and the
 * exclusive jobs are shared between them. Start two instances on different ports to see it.
 * @param port The HTTP port of the instance. Without it, the port is read from the `PORT` environment variable.
 */
export const createApp = (port?: number) => {
    const app = AxiSparkFactory.create({
        name: 'Shared Stores',
        basePath: __dirname,
        settings: {
            envFiles: ['.env'],
            load: (env) => ({
                port: port ?? env.int('PORT', { default: 3000, min: 1, max: 65535 }),
                redisUrl: env.url('REDIS_URL', { default: 'redis://localhost:6379/2', protocols: ['redis', 'rediss'] })
            })
        },
        logTransports: [
            new ConsoleTransport({
                minLevel: LogLevel.Debug,
                formatter: new SimpleFormatter()
            })
        ]
    });

    // One provider for every store: each plugin asks it for the kind of store it needs.
    const redis = RedisStore('MAIN', { prefix: 'shared-stores:' });

    app.use(RedisPlugin, RedisPluginOptionsFactory.create({ connections: [{ name: 'MAIN', url: app.settings.redisUrl }] }));
    app.use(SchedulePlugin, SchedulePluginOptionsFactory.create({ lockStore: redis }));
    app.use(
        HttpPlugin,
        HttpPluginOptionsFactory.create({
            port: app.settings.port,
            basePath: '/api',
            rateLimit: true,
            rateLimitOptions: { ttl: 10_000, limit: 3, store: redis }
        })
    );

    return app;
};
