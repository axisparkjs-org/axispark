# `@axisparkjs/core`

Application bootstrap, plugin system and health engine of AxiSpark.js. Every AxiSpark.js application starts with this package.

The complete guide is in the [Getting Started documentation](https://axisparkjs.com/docs/category/getting-started).

## What the package does

- Creates the application with `AxiSparkFactory.create()` and manages its lifecycle (`init`, `run`, `destroy`).
- Registers plugins with `app.use()` and runs their `onRegister`, `onStart` and `onStop` hooks in dependency order.
- Scans the application `basePath` to discover decorated classes such as controllers, jobs or repositories. The `scanner` option selects the loaded files with `include` and `exclude` glob patterns.
- Loads typed and validated application settings from the environment variables and `.env` files with the `settings` option, available in `app.settings` and by injection with `@EnvSettings()`.
- Reports the application, plugin and `@HealthCheck` status through the `HealthEngine`.

## Install and register

```bash
npm install @axisparkjs/core @axisparkjs/di @axisparkjs/logger
```

Create a plugin and register it in the application:

```ts title="app.ts"
import { AxiSparkFactory, Plugin } from '@axisparkjs/core';
import { Injectable } from '@axisparkjs/di';
import { ConsoleTransport, Logger, LogLevel, SimpleFormatter } from '@axisparkjs/logger';

@Injectable()
export class HelloPlugin extends Plugin {
    constructor(private readonly logger: Logger) {
        super();
    }

    async onStart() {
        await this.logger.info('Hello from AxiSpark.js');
    }
}

export const app = AxiSparkFactory.create({
    name: 'Example',
    basePath: __dirname,
    logTransports: [new ConsoleTransport({ minLevel: LogLevel.Info, formatter: new SimpleFormatter() })]
});

app.use(HelloPlugin);
```

```ts title="index.bootstrap.ts"
import { app } from './app';

const bootstrap = async () => {
    try {
        await app.init();
        await app.run();
    } finally {
        await app.destroy();
    }
};

bootstrap().catch(() => process.exit(1));
```

## Settings

The `settings` option reads the environment variables and the `.env` files, converts them to their types and validates them when the application is created. A variable without a default is required, and an `InvalidSettingsError` lists every missing or invalid variable. The real environment variables win over the files, which are parsed with `util.parseEnv()` of Node.js.

```ts title="app.ts"
export const app = AxiSparkFactory.create({
    name: 'Orders',
    basePath: __dirname,
    settings: {
        envFiles: ['.env'],
        load: (env) => ({
            port: env.int('PORT', 3000),
            databaseUrl: env.url('DATABASE_URL'),
            sessionSecret: env.string('SESSION_SECRET', { minLength: 32 }),
            cacheStore: env.enum('CACHE_STORE', ['memory', 'redis'], 'memory')
        })
    }
});

app.use(HttpPlugin, HttpPluginOptionsFactory.create({ port: app.settings.port }));
```

The reader has the `string`, `int`, `float`, `boolean`, `enum`, `url`, `json` and `list` methods. The settings object is deeply frozen and is injected with `@EnvSettings()` or the `AXISPARK_ENV_SETTINGS` token.
