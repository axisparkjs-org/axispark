# `@axisparkjs/test`

Testing utilities for AxiSpark.js applications.

The complete guide is in the [Testing documentation](https://axisparkjs.github.io/axispark/docs/getting-started/testing).

## What the package does

- Creates an isolated application with `AxiSparkTestFactory.create()`, with logs disabled and the `test` environment.
- Replaces dependencies with mocks through the `providers` option.
- Reuses the plugins of an existing application through the `app` option to run end-to-end tests.

It works with any test runner, such as Jest, Mocha or Jasmine.

## Install and use

```bash
npm install --save-dev @axisparkjs/test
```

```ts title="order.service.spec.ts"
import { AxiSparkCore } from '@axisparkjs/core';
import { Logger } from '@axisparkjs/logger';
import { AxiSparkTestFactory } from '@axisparkjs/test';
import { OrderService } from './order.service';

describe('OrderService', () => {
    const logger = { info: jest.fn(), child: jest.fn().mockReturnThis() };
    let app: AxiSparkCore;

    beforeAll(() => {
        app = AxiSparkTestFactory.create({
            providers: [{ token: Logger, useValue: logger }, OrderService]
        });
    });

    it('logs created orders', async () => {
        const service = await app.get(OrderService);
        await service.create();
        expect(logger.info).toHaveBeenCalledWith('Order created');
    });
});
```
