# `@axisparkjs/websocket`

WebSocket plugin of AxiSpark.js. It defines event handlers independently of the WebSocket server, which is provided by an adapter package.

The complete guide is in the [WebSocket Plugin documentation](https://axisparkjs.com/docs/category/websocket-plugin).

## What the package does

- Declares namespaces with `@WebSocket()` and event handlers with `@WebSocketEvent()`, including regular expressions.
- Resolves handler parameters with `@WsData()`, `@WsMessage()`, `@WsConnection()` and `@WsAck()`.
- Sends the returned value of a handler back to the client and supports acknowledgments.
- Runs every event through the AxiSpark.js engine pipeline (middlewares, guards, interceptors and filters).

## Install and register

Install the WebSocket plugin with an adapter, such as `@axisparkjs/websocket-socketio`:

```bash
npm install @axisparkjs/websocket @axisparkjs/websocket-socketio
```

```ts title="app.ts"
import { AxiSparkFactory } from '@axisparkjs/core';
import { WebSocketPlugin } from '@axisparkjs/websocket';
import { WebSocketPluginOptionsFactory } from '@axisparkjs/websocket-socketio';

const app = AxiSparkFactory.create({ name: 'Example', basePath: __dirname });

app.use(WebSocketPlugin, WebSocketPluginOptionsFactory.create({ port: 3000 }));
```

```ts title="chat.ts"
import { WebSocket, WebSocketEvent, WsData } from '@axisparkjs/websocket';

@WebSocket('/chat')
export class ChatWebSocket {
    @WebSocketEvent('message')
    public async onMessage(@WsData() data: unknown) {
        return { message: 'Received message', data };
    }
}
```
