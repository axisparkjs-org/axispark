# `@axisparkjs/http`

HTTP plugin of AxiSpark.js. It defines controllers, routes, parameters and responses independently of the HTTP server, which is provided by an adapter package.

The complete guide is in the [Http Plugin documentation](https://axisparkjs.github.io/axispark/docs/category/http-plugin).

## What the package does

- Declares controllers and routes with `@Controller()`, `@Get()`, `@Post()`, `@Put()`, `@Delete()`...
- Resolves request data with parameter decorators such as `@Path()`, `@Query()`, `@Body()`, `@Header()` and `@Cookie()`.
- Maps thrown HTTP errors (`NotFoundError`, `BadRequestError`...) to responses.
- Supports versioning, host routing, timeouts, rate limiting, file uploads and health check endpoints.

## Install and register

Install the HTTP plugin with one of the adapters, `@axisparkjs/http-express` or `@axisparkjs/http-fastify`:

```bash
npm install @axisparkjs/http @axisparkjs/http-express
```

```ts title="app.ts"
import { AxiSparkFactory } from '@axisparkjs/core';
import { HttpPlugin } from '@axisparkjs/http';
import { HttpPluginOptionsFactory } from '@axisparkjs/http-express';

const app = AxiSparkFactory.create({ name: 'Example', basePath: __dirname });

app.use(HttpPlugin, HttpPluginOptionsFactory.create({ basePath: '/api', port: 3000 }));
```

```ts title="controller.ts"
import { Body, Controller, Get, NotFoundError, Path, Post } from '@axisparkjs/http';

@Controller('todos')
export class TodoController {
    private readonly todos: string[] = [];

    @Get(':index')
    getTodo(@Path('index') index: string) {
        const todo = this.todos[Number(index)];
        if (todo === undefined) throw new NotFoundError('Todo not found');
        return { todo };
    }

    @Post()
    addTodo(@Body() body: { task: string }) {
        this.todos.push(body.task);
        return { index: this.todos.length - 1 };
    }
}
```
