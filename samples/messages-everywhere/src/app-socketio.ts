import { AxiSparkFactory } from '@axisparkjs/core';
import { ConsoleTransport, LogLevel, SimpleFormatter } from '@axisparkjs/logger';
import { WebSocketPlugin } from '@axisparkjs/websocket';
import { WebSocketPluginOptionsFactory } from '@axisparkjs/websocket-socketio';

export const app = AxiSparkFactory.create({
    name: 'Messages Everywhere App',
    basePath: __dirname,
    logTransports: [
        new ConsoleTransport({
            minLevel: LogLevel.Info,
            formatter: new SimpleFormatter()
        })
    ]
});

app.use(
    WebSocketPlugin,
    WebSocketPluginOptionsFactory.create({
        useHttpPluginServer: false,
        port: 3000,
        timeout: true,
        timeoutOptions: {
            time: 300
        }
    })
);
