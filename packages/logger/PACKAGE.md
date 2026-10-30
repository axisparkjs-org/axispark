# `@axisparkjs/logger`

Logger of AxiSpark.js with pluggable transports and formatters.

The complete guide is in the [Logging documentation](https://axisparkjs.com/docs/getting-started/logging).

## What the package does

- Provides the injectable `Logger` with `trace`, `debug`, `info`, `warn`, `error` and `fatal` levels, and scoped child loggers.
- Writes logs through transports: console, file, daily and rotating files, streams, HTTP, webhooks, memory or none.
- Formats entries with the simple, pretty, JSON, XML or template formatters.

## Install and use

```bash
npm install @axisparkjs/logger
```

Configure the transports when creating the application:

```ts title="app.ts"
import { AxiSparkFactory } from '@axisparkjs/core';
import { ConsoleTransport, LogLevel, SimpleFormatter } from '@axisparkjs/logger';

export const app = AxiSparkFactory.create({
    name: 'Example',
    basePath: __dirname,
    logTransports: [new ConsoleTransport({ minLevel: LogLevel.Info, formatter: new SimpleFormatter() })]
});
```

Inject the `Logger` in any injectable class:

```ts
import { Injectable } from '@axisparkjs/di';
import { Logger } from '@axisparkjs/logger';

@Injectable()
export class OrderService {
    private readonly logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger.child('OrderService');
    }

    async create(): Promise<void> {
        await this.logger.info('Order created');
    }
}
```
