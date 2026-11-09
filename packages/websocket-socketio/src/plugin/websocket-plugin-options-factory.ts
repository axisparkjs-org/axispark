import { Factory } from '@axisparkjs/common';
import { WebSocketPlugin } from '@axisparkjs/websocket';
import { SocketIOWebSocketAdapter } from '../adapter/socketio-websocket-adapter';
import { SocketIOWebSocketPluginOptions } from './socketio-websocket-plugin-options';

/**
 * A factory class for creating default Socket.IO WebSocket plugin options. This class implements the Factory interface and provides a method to create an instance of SocketIOWebSocketPluginOptions with default values, allowing for optional overrides.
 */
export class WebSocketPluginOptionsFactoryStatic implements Factory<SocketIOWebSocketPluginOptions> {
    create(options?: Partial<Omit<SocketIOWebSocketPluginOptions, 'plugin' | 'adapter'>>): SocketIOWebSocketPluginOptions {
        return {
            plugin: WebSocketPlugin,
            connectTimeout: 5000,
            path: '/websocket',
            serveClient: true,
            adapter: SocketIOWebSocketAdapter,
            useHttpPluginServer: false,
            port: 3000,
            timeout: false,
            rateLimit: false,
            ...options,
            timeoutOptions: {
                time: 5000,
                ...options?.timeoutOptions
            }
        };
    }
}

export const WebSocketPluginOptionsFactory = new WebSocketPluginOptionsFactoryStatic();
