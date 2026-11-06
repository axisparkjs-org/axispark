# `@axisparkjs/redis`

[Redis](https://redis.io/) connections for AxiSpark.js, based on [`node-redis`](https://github.com/redis/node-redis) (the `redis` package).

The complete guide is in the [Redis documentation](https://axisparkjs.com/docs/connections/redis).

## What the package does

- Creates one or more named Redis connections and closes them when the application stops.
- Logs the `ready`, `reconnecting`, `error` and `end` events of every client. Connection errors never stop the process.
- Injects connections with `@InjectRedisConnection()`.
- Exposes every connection through the `RedisConnectionManager`.
- Registers a `redis:<name>` health check for each connection, which sends a `PING` and reports its latency.

## Install and register

```bash
npm install @axisparkjs/redis redis
```

```ts title="app.ts"
import { AxiSparkFactory } from '@axisparkjs/core';
import { RedisPlugin, RedisPluginOptionsFactory } from '@axisparkjs/redis';

const app = AxiSparkFactory.create({ name: 'Example', basePath: __dirname });

app.use(
    RedisPlugin,
    RedisPluginOptionsFactory.create({
        connections: [
            { name: 'CACHE', url: 'redis://localhost:6379/0' },
            { name: 'LOCKS', url: 'redis://localhost:6379/1', options: { socket: { connectTimeout: 5000 } } }
        ]
    })
);
```

```ts title="session-cache.ts"
import { Injectable } from '@axisparkjs/di';
import { InjectRedisConnection } from '@axisparkjs/redis';
import { RedisClientType } from 'redis';

@Injectable()
export class SessionCache {
    constructor(@InjectRedisConnection('CACHE') private readonly redis: RedisClientType) {}

    async get(id: string): Promise<string | null> {
        return await this.redis.get(`session:${id}`);
    }
}
```

By default, the clients connect in the background and keep reconnecting when Redis is not available, and their health checks report them as unhealthy. Set `failOnConnectError: true` to make the application fail to start when a connection cannot be established.
