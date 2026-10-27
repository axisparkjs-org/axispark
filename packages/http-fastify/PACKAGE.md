# `@axisparkjs/http-fastify`

[Fastify](https://fastify.dev/) adapter for the AxiSpark.js HTTP plugin.

The complete guide is in the [Http Plugin documentation](https://axisparkjs.github.io/axispark/docs/category/http-plugin).

## What the package does

- Runs the `@axisparkjs/http` controllers on a Fastify server.
- Provides `HttpPluginOptionsFactory`, which sets the Fastify adapter and the default HTTP plugin options.
- Integrates body parsing, cookies, sessions, CORS, compression and file uploads through Fastify.

Use `@axisparkjs/http-express` instead if you prefer Express. Your controllers do not change.

## Install and register

```bash
npm install @axisparkjs/http @axisparkjs/http-fastify
```

```ts title="app.ts"
import { AxiSparkFactory } from '@axisparkjs/core';
import { HttpPlugin } from '@axisparkjs/http';
import { HttpPluginOptionsFactory } from '@axisparkjs/http-fastify';

const app = AxiSparkFactory.create({ name: 'Example', basePath: __dirname });

app.use(
    HttpPlugin,
    HttpPluginOptionsFactory.create({
        basePath: '/api',
        port: 3000,
        healthChecks: true
    })
);
```

Every option not passed to `create()` keeps its default value.
