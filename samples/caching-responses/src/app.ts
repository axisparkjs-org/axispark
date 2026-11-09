import { AxiSparkFactory } from '@axisparkjs/core';
import { HttpPlugin } from '@axisparkjs/http';
import { HttpPluginOptionsFactory } from '@axisparkjs/http-express';
import { ConsoleTransport, LogLevel, SimpleFormatter } from '@axisparkjs/logger';
import { RedisPlugin, RedisPluginOptionsFactory, RedisStore } from '@axisparkjs/redis';

/**
 * Creates one instance of the application.
 * @param port The HTTP port of the instance.
 * @param store `memory` keeps the cache in the process (`MemoryStore()`, the default). `redis` keeps it in Redis, so every instance shares it.
 */
export const createApp = (port: number, store: 'memory' | 'redis' = 'memory') => {
    const app = AxiSparkFactory.create({
        name: `Caching Responses ${port}`,
        basePath: __dirname,
        logTransports: [
            new ConsoleTransport({
                minLevel: LogLevel.Debug,
                formatter: new SimpleFormatter()
            })
        ]
    });

    if (store === 'redis') {
        app.use(RedisPlugin, RedisPluginOptionsFactory.create({ connections: [{ name: 'MAIN', url: 'redis://localhost:6379/3' }] }));
    }

    app.use(
        HttpPlugin,
        HttpPluginOptionsFactory.create({
            port,
            basePath: '/api',
            cacheOptions: {
                ttl: 60_000,
                store: store === 'redis' ? RedisStore('MAIN', { prefix: 'caching-responses:' }) : undefined
            }
        })
    );

    return app;
};
