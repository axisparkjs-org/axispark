# `@axisparkjs/engine`

Transport-neutral execution engine of AxiSpark.js. HTTP, WebSocket and other transports run every request through the same pipeline.

The complete guide is in the [Engine System documentation](https://axisparkjs.com/docs/category/engine-system).

## What the package does

- Runs each execution through middlewares, guards, interceptors, the handler and filters.
- Declares engine steps with `@Middleware()`, `@Guard()`, `@Interceptor()` and `@Filter()`, globally or per transport.
- Resolves handler parameters with decorators such as `@Context()`, and transforms or validates them with pipes (`@Pipe()`).
- Gives every execution an `AbortSignal` (`@Signal()`), aborted when the execution times out or its client stops waiting, so handlers can stop their work.
- Supports timeouts and rate limiting for executions. The rate limit buckets and the sliding window are shared by every transport, which only identifies its clients. The buckets are kept by a `RateLimitStore` from `@axisparkjs/store`.

## Install and use

```bash
npm install @axisparkjs/engine
```

A guard that rejects HTTP requests without an API key:

```ts
import { Check, Context, ExecutionTransport, Guard } from '@axisparkjs/engine';
import { HttpContext, UnauthorizedError } from '@axisparkjs/http';

@Guard({ transport: ExecutionTransport.Http, global: true })
export class ApiKeyGuard {
    @Check()
    public async check(@Context() context: HttpContext): Promise<void> {
        if (!context.request.getHeader('x-api-key')) {
            throw new UnauthorizedError('Missing API key');
        }
    }
}
```

Transform a handler parameter with a pipe:

```ts
import { ParseInt, Pipe } from '@axisparkjs/engine';
import { Controller, Get, Path } from '@axisparkjs/http';

@Controller('todos')
export class TodoController {
    @Get(':index')
    getTodo(@Path('index') @Pipe(ParseInt(10)) index: number) {
        return { index };
    }
}
```

Stop the work of a handler when it times out or the client disconnects:

```ts
@Get('report')
@Timeout(5000)
async report(@Signal() signal: AbortSignal) {
    const response = await fetch(this.reportsUrl, { signal });
    return response.json();
}
```
