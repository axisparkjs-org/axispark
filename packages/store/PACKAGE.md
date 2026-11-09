# `@axisparkjs/store`

Pluggable stores of AxiSpark.js: where the framework features keep their state, such as the rate limit buckets and the locks of the exclusive jobs.

The complete guide is in the [Stores documentation](https://axisparkjs.com/docs/getting-started/stores).

## What the package does

- Defines the contracts of each kind of store: `RateLimitStore` (`rate-limit`), `LockStore` (`lock`) and `CacheStore` (`cache`).
- Defines `StoreProvider`, a function that a plugin calls with the kind of store it needs. A provider declares the kinds it supports, so passing it where an unsupported kind is required is a compile error.
- Provides `MemoryStore()`, the default provider of every feature, with `InMemoryRateLimitStore`, `InMemoryLockStore` and `InMemoryCacheStore`.
- Lets packages add their own kinds with declaration merging on `StoreTypes`.

## Install and use

The plugins that use stores install this package. Pass a provider in their options to replace the in-memory default, for example `RedisStore` from `@axisparkjs/redis` to share the state between several instances:

```ts title="app.ts"
import { RedisStore } from '@axisparkjs/redis';
import { SchedulePlugin, SchedulePluginOptionsFactory } from '@axisparkjs/schedule';

const redis = RedisStore('MAIN', { prefix: 'myapp:' });

app.use(SchedulePlugin, SchedulePluginOptionsFactory.create({ lockStore: redis }));
app.use(HttpPlugin, HttpPluginOptionsFactory.create({ rateLimit: true, rateLimitOptions: { ttl: 60_000, limit: 100, store: redis } }));
```

A custom store is a provider too:

```ts
import { RateLimitDecision, RateLimitPolicy, RateLimitStore } from '@axisparkjs/store';

class DatabaseRateLimitStore implements RateLimitStore {
    async consume(key: string, policy: RateLimitPolicy): Promise<RateLimitDecision> {
        // Count the request of the key in a sliding window of policy.ttl milliseconds.
    }
}

HttpPluginOptionsFactory.create({ rateLimit: true, rateLimitOptions: { ttl: 60_000, limit: 100, store: () => new DatabaseRateLimitStore() } });
```
