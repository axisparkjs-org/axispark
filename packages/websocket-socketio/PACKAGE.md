# `@axisparkjs/websocket-socketio`

[Socket.IO](https://socket.io/) adapter for the AxiSpark.js WebSocket plugin.

The complete guide is in the [WebSocket Plugin documentation](https://axisparkjs.com/docs/category/websocket-plugin).

## What the package does

- Runs the `@axisparkjs/websocket` handlers on a Socket.IO server.
- Provides `WebSocketPluginOptionsFactory`, which sets the Socket.IO adapter and the default plugin options.
- Starts its own server on the configured `port`, or shares the HTTP plugin server with `useHttpPluginServer: true`.

## Install and register

```bash
npm install @axisparkjs/websocket @axisparkjs/websocket-socketio
```

```ts title="app.ts"
import { AxiSparkFactory } from '@axisparkjs/core';
import { WebSocketPlugin } from '@axisparkjs/websocket';
import { WebSocketPluginOptionsFactory } from '@axisparkjs/websocket-socketio';

const app = AxiSparkFactory.create({ name: 'Example', basePath: __dirname });

app.use(
    WebSocketPlugin,
    WebSocketPluginOptionsFactory.create({
        useHttpPluginServer: false,
        port: 3000
    })
);
```

Clients connect with `socket.io-client`:

```ts
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/chat');
socket.emit('message', { text: 'Hello' });
```
