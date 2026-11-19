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
export const createApp = (port?: number, store?: 'memory' | 'redis') => {
    const app = AxiSparkFactory.create({
        name: 'Caching Responses',
        basePath: __dirname,
        // The arguments win over the environment, so the e2e tests can start several instances on fixed ports.
        settings: {
            envFiles: ['.env'],
            load: (env) => ({
                port: port ?? env.int('PORT', { default: 3000, min: 1, max: 65535 }),
                cacheStore: store ?? env.enum('CACHE_STORE', ['memory', 'redis'], 'memory'),
                redisUrl: env.url('REDIS_URL', { default: 'redis://localhost:6379/3', protocols: ['redis', 'rediss'] })
            })
        },
        logTransports: [
            new ConsoleTransport({
                minLevel: LogLevel.Debug,
                formatter: new SimpleFormatter()
            })
        ]
    });

    const { settings } = app;

    if (settings.cacheStore === 'redis') {
        app.use(RedisPlugin, RedisPluginOptionsFactory.create({ connections: [{ name: 'MAIN', url: settings.redisUrl }] }));
    }

    app.use(
        HttpPlugin,
        HttpPluginOptionsFactory.create({
            port: settings.port,
            basePath: '/api',
            cacheOptions: {
                ttl: 60_000,
                store: settings.cacheStore === 'redis' ? RedisStore('MAIN', { prefix: 'caching-responses:' }) : undefined
            }
        })
    );

    return app;
};
