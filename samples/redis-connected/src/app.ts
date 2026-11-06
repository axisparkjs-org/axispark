import { AxiSparkFactory } from '@axisparkjs/core';
import { ConsoleTransport, LogLevel, SimpleFormatter } from '@axisparkjs/logger';
import { RedisPlugin, RedisPluginOptionsFactory } from '@axisparkjs/redis';
import { SchedulePlugin } from '@axisparkjs/schedule';

export const app = AxiSparkFactory.create({
    name: 'Redis Connected App',
    basePath: __dirname,
    logTransports: [
        new ConsoleTransport({
            minLevel: LogLevel.Trace,
            formatter: new SimpleFormatter()
        })
    ]
});
app.use(SchedulePlugin);
app.use(
    RedisPlugin,
    RedisPluginOptionsFactory.create({
        connections: [
            {
                name: 'CACHE',
                url: 'redis://localhost:6379/0'
            },
            {
                name: 'LOCKS',
                url: 'redis://localhost:6379/1',
                options: {
                    socket: { connectTimeout: 5000 }
                }
            },
            {
                // Nothing listens on this port: the client keeps reconnecting and the connection is reported as unhealthy.
                name: 'BROKEN',
                url: 'redis://localhost:6390',
                options: {
                    socket: { reconnectStrategy: (retries) => Math.min(retries * 500, 5000) }
                }
            }
        ]
    })
);
