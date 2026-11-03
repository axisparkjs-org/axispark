# `@axisparkjs/mcp`

MCP plugin of AxiSpark.js. It exposes the tools, resources and prompts of an application to AI clients (assistants, IDEs and agents) through the [Model Context Protocol](https://modelcontextprotocol.io).

The complete guide is in the [MCP Plugin documentation](https://axisparkjs.com/docs/category/mcp-plugin).

## What the package does

- Declares groups of capabilities with `@McpServer()`, and tools, resources and prompts with `@McpTool()`, `@McpResource()` and `@McpPrompt()`.
- Resolves handler parameters with `@McpArgs()`, `@McpParam()`, `@McpSession()` and `@McpContext()`, and resolves the classes through the dependency injection container.
- Publishes the JSON Schema of each tool input, generated from the `class-validator` class of its `@McpArgs()` parameter.
- Runs every request through the AxiSpark.js engine pipeline, so pipes such as `ValidateSchema()`, filters and timeouts work as in HTTP and WebSocket.
- Converts the returned values into MCP content, with `McpResults` helpers for images, audio, resources and prompt messages, and returns errors without closing the session.
- Serves the protocol over stdio or Streamable HTTP, on its own port or mounted on the HTTP plugin server.

## Install and register

```bash
npm install @axisparkjs/mcp class-validator
```

```ts title="app.ts"
import { AxiSparkFactory } from '@axisparkjs/core';
import { McpPlugin, McpPluginOptionsFactory } from '@axisparkjs/mcp';

const app = AxiSparkFactory.create({ name: 'Example', basePath: __dirname });

app.use(McpPlugin, McpPluginOptionsFactory.create({ transport: 'http', path: '/mcp', port: 3000 }));
```

```ts title="users-mcp.ts"
import { Pipe, ValidateSchema } from '@axisparkjs/engine';
import { McpArgs, McpParam, McpResource, McpServer, McpTool } from '@axisparkjs/mcp';
import { IsString } from 'class-validator';
import { UserService } from './user-service';

export class SearchUsersDto {
    @IsString()
    query: string;
}

@McpServer({ prefix: 'users' })
export class UsersMcp {
    constructor(private readonly users: UserService) {}

    @McpTool('search', { description: 'Search users by name' })
    search(@McpArgs() @Pipe(ValidateSchema()) args: SearchUsersDto) {
        return this.users.search(args.query);
    }

    @McpResource('users://{id}', { description: 'User profile', mimeType: 'application/json' })
    profile(@McpParam('id') id: string) {
        return this.users.findById(id);
    }
}
```

The MCP endpoint is available at `http://localhost:3000/mcp`. With the stdio transport, write the logs to `stderr` (for example with a `StreamTransport` over `process.stderr`) and disable the banner, because the standard output carries the protocol.
