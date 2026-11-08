import { AxiSparkFactory } from '@axisparkjs/core';
import { HttpPlugin } from '@axisparkjs/http';
import { HttpPluginOptionsFactory } from '@axisparkjs/http-express';
import { ConsoleTransport, LogLevel, SimpleFormatter } from '@axisparkjs/logger';
import { WebSocketPlugin } from '@axisparkjs/websocket';
import { WebSocketPluginOptionsFactory } from '@axisparkjs/websocket-socketio';

export const app = AxiSparkFactory.create({
    name: 'HTTP and WebSockets App',
    basePath: __dirname,
    logTransports: [
        new ConsoleTransport({
            minLevel: LogLevel.Info,
            formatter: new SimpleFormatter()
        })
    ]
});

app.use(
    HttpPlugin,
    HttpPluginOptionsFactory.create({
        basePath: '/api',
        port: 3000
    })
);

app.use(
    WebSocketPlugin,
    WebSocketPluginOptionsFactory.create({
        useHttpPluginServer: true
    })
);
