import { AxiSparkTestFactory } from '@axisparkjs/test';
import { AxiSparkCore } from '@axisparkjs/core';
import { WebSocketPlugin } from '@axisparkjs/websocket';
import { app as appSocketio } from '@axisparkjs/samples/messages-everywhere/src/app-socketio';
import { SocketIOWebSocketAdapter } from '@axisparkjs/websocket-socketio';
import { io, Socket } from 'socket.io-client';

describe.each([{ name: 'Socket.IO', app: appSocketio }])('Messages Everywhere App ($name)', ({ app, name }) => {
    let axiSparkCore: AxiSparkCore;
    let socket: Socket;
    let socketV2: Socket;

    beforeAll(async () => {
        axiSparkCore = AxiSparkTestFactory.create({
            app
        });
        await axiSparkCore.init();
        await axiSparkCore.run();
    });

    beforeEach(async () => {
        socket = io(`http://localhost:3000`, {
            path: '/websocket'
        });
    });

    it('should create an instance of AxiSparkTestCore', () => {
        expect(axiSparkCore).toBeInstanceOf(AxiSparkCore);
    });

    it('should create the app with WebSocket plugin', async () => {
        const plugins = axiSparkCore.used();
        expect(plugins).toHaveLength(1);
        expect(plugins).toStrictEqual([
            {
                type: WebSocketPlugin,
                options: expect.objectContaining({
                    adapter: name === 'Socket.IO' ? SocketIOWebSocketAdapter : undefined,
                    plugin: WebSocketPlugin,
                    useHttpPluginServer: false,
                    port: 3000
                })
            }
        ]);
    });

    it('should connect to the WebSocket server', async () => {
        await new Promise<void>((resolve, reject) => {
            socket.on('connect', () => resolve());
            socket.on('connect_error', (err) => reject(err));
        });

        expect(socket.id).toBeDefined();
    });

    it('should send and receive a message', async () => {
        const message = { text: 'Hello, WebSocket!' };
        const response = await new Promise<any>((resolve, reject) => {
            socket.emit('message', message, (ackResponse: any) => {
                resolve(ackResponse);
            });
            socket.on('error', (err) => reject(err));
        });

        expect(response).toEqual({
            message: 'Received message',
            data: message
        });
    });

    it('should send and receive a message with ack', async () => {
        const message = { text: 'Hello, WebSocket!' };
        const response = await new Promise<any>((resolve, reject) => {
            socket.emit('message-ack', message, (ackResponse: any) => {
                resolve(ackResponse);
            });
            socket.on('error', (err) => reject(err));
        });

        expect(response).toEqual({
            message: 'Received message ack',
            data: message
        });
    });

    it('should send and receive a message with context', async () => {
        const message = { text: 'Hello, WebSocket!' };
        const response = await new Promise<any>((resolve, reject) => {
            socket.emit('context', message, (ackResponse: any) => {
                resolve(ackResponse);
            });
            socket.on('error', (err) => reject(err));
        });

        expect(response).toEqual({
            context: true,
            message: true,
            connection: true,
            containsEq: true
        });
    });

    it('should dispatch events whose names match a regular expression', async () => {
        const data = { id: 42 };
        const response = await new Promise<any>((resolve, reject) => {
            socket.emit('user:created', data, (ackResponse: any) => resolve(ackResponse));
            socket.on('error', (err) => reject(err));
        });

        expect(response).toEqual({ event: 'user:created', data });
    });

    it('should receive a connection event', async () => {
        const response = await new Promise<any>((resolve, reject) => {
            socket.on('connection-event', (data: any) => {
                resolve(data);
            });
            socket.on('error', (err) => reject(err));
        });

        expect(response).toEqual({
            message: 'Connection event',
            connectionId: socket.id
        });
    });

    it('should use v2 websocket namespace', async () => {
        socketV2 = io(`http://localhost:3000/chat-v2`, {
            path: '/websocket'
        });

        let response = await new Promise<any>((resolve, reject) => {
            socketV2.on('connection-event-v2', (data: any) => {
                resolve(data);
            });
            socketV2.on('error', (err) => reject(err));
        });

        expect(response).toEqual({
            message: 'Connection event',
            connectionId: socketV2.id
        });

        const message = { text: 'Hello, WebSocket!' };
        response = await new Promise<any>((resolve, reject) => {
            socketV2.emit('message', message, (ackResponse: any) => {
                resolve(ackResponse);
            });
            socketV2.on('error', (err) => reject(err));
        });

        expect(response).toEqual({
            message: 'Received message v2',
            data: message
        });
    });

    afterEach(async () => {
        socket?.close();
        socketV2?.close();
    });

    afterAll(async () => {
        await axiSparkCore.destroy();
    });
});
