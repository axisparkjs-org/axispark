# `@axisparkjs/openapi`

Generates an [OpenAPI](https://www.openapis.org/) document from the controllers of the AxiSpark.js HTTP plugin.

The complete guide is in the [OpenApi Plugin documentation](https://axisparkjs.github.io/axispark/docs/category/openapi-plugin).

## What the package does

- Builds the OpenAPI document from the registered routes and their parameters.
- Describes schemas and responses with `@OpenApiSchema()`, `@OpenApiProperty()` and `@OpenApiResponse()`.
- Serves the document as JSON (`openapi.json`) and YAML (`openapi.yaml`) under the HTTP plugin `basePath`.

## Install and register

```bash
npm install @axisparkjs/openapi @axisparkjs/http @axisparkjs/http-express
```

```ts title="app.ts"
import { AxiSparkFactory } from '@axisparkjs/core';
import { HttpPlugin } from '@axisparkjs/http';
import { HttpPluginOptionsFactory } from '@axisparkjs/http-express';
import { OpenApiPlugin, OpenApiPluginOptionsFactory } from '@axisparkjs/openapi';

const app = AxiSparkFactory.create({ name: 'Example', basePath: __dirname });

app.use(OpenApiPlugin, OpenApiPluginOptionsFactory.create({ info: { title: 'Todo API', version: '1.0.0' } }));
app.use(HttpPlugin, HttpPluginOptionsFactory.create({ basePath: '/api' }));
```

```ts title="controller.ts"
import { Controller, Get } from '@axisparkjs/http';
import { OpenApiProperty, OpenApiResponse, OpenApiSchema } from '@axisparkjs/openapi';

@OpenApiSchema()
export class Todo {
    @OpenApiProperty()
    task: string;
}

@Controller('todos')
export class TodoController {
    @Get()
    @OpenApiResponse({ statusCode: 200, type: 'array', items: [{ type: Todo }], description: 'Returns a list of todos' })
    getTodos(): Todo[] {
        return [{ task: 'Write the docs' }];
    }
}
```

The document is available at `http://localhost:3000/api/openapi.json`.
