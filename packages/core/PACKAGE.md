# `@axisparkjs/core`

Application bootstrap, plugin system and health engine of AxiSpark.js. Every AxiSpark.js application starts with this package.

The complete guide is in the [Getting Started documentation](https://axisparkjs.com/docs/category/getting-started).

## What the package does

- Creates the application with `AxiSparkFactory.create()` and manages its lifecycle (`init`, `run`, `destroy`).
- Registers plugins with `app.use()` and runs their `onRegister`, `onStart` and `onStop` hooks in dependency order.
- Scans the application `basePath` to discover decorated classes such as controllers, jobs or repositories.
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
