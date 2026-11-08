import { AxiSparkFactory } from '@axisparkjs/core';
import { HttpPlugin } from '@axisparkjs/http';
import { HttpPluginOptionsFactory } from '@axisparkjs/http-express';
import { ConsoleTransport, LogLevel, SimpleFormatter } from '@axisparkjs/logger';
import { RedisPlugin, RedisPluginOptionsFactory, RedisStore } from '@axisparkjs/redis';
import { WebSocketPlugin } from '@axisparkjs/websocket';
import { WebSocketPluginOptionsFactory } from '@axisparkjs/websocket-socketio';

export const app = AxiSparkFactory.create({
    name: 'Rate Limited Sockets',
    basePath: __dirname,
    logTransports: [
        new ConsoleTransport({
            minLevel: LogLevel.Info,
            formatter: new SimpleFormatter()
        })
    ]
});

app.use(RedisPlugin, RedisPluginOptionsFactory.create({ connections: [{ name: 'MAIN', url: 'redis://localhost:6379/3' }] }));

// The HTTP rate limits are counted in the process, with the default in-memory store.
app.use(
    HttpPlugin,
    HttpPluginOptionsFactory.create({
        port: 3000,
        basePath: '/api',
        rateLimit: true,
        rateLimitOptions: { ttl: 10_000, limit: 3 }
    })
);

// The WebSocket rate limits are counted in Redis, so they are shared between every instance of the application.
app.use(
    WebSocketPlugin,
    WebSocketPluginOptionsFactory.create({
        useHttpPluginServer: true,
        rateLimit: true,
        rateLimitOptions: { ttl: 10_000, limit: 5, store: RedisStore('MAIN', { prefix: 'rate-limited-sockets:' }) }
    })
);
