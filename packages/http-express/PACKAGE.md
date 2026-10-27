# `@axisparkjs/http-express`

[Express](https://expressjs.com/) adapter for the AxiSpark.js HTTP plugin.

The complete guide is in the [Http Plugin documentation](https://axisparkjs.github.io/axispark/docs/category/http-plugin).

## What the package does

- Runs the `@axisparkjs/http` controllers on a Express server.
- Provides `HttpPluginOptionsFactory`, which sets the Express adapter and the default HTTP plugin options.
- Integrates body parsing, cookies, sessions, CORS, compression and file uploads through Express.

Use `@axisparkjs/http-fastify` instead if you prefer Fastify. Your controllers do not change.

## Install and register

```bash
npm install @axisparkjs/http @axisparkjs/http-express
```

```ts title="app.ts"
import { AxiSparkFactory } from '@axisparkjs/core';
import { HttpPlugin } from '@axisparkjs/http';
import { HttpPluginOptionsFactory } from '@axisparkjs/http-express';

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
