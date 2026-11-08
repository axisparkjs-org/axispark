import { AxiSparkTestFactory } from '@axisparkjs/test';
import { AxiSparkCore } from '@axisparkjs/core';
import { HttpPlugin } from '@axisparkjs/http';
import { WebSocketPlugin } from '@axisparkjs/websocket';
import { app } from '@axisparkjs/samples/http-and-websockets/src/app';
import { io, Socket } from 'socket.io-client';

describe('HTTP and WebSockets App', () => {
    let axiSparkCore: AxiSparkCore;
    let socket: Socket;

    const emit = (event: string, data?: unknown) => new Promise<any>((resolve) => socket.emit(event, data, (response: unknown) => resolve(response)));

    beforeAll(async () => {
        axiSparkCore = AxiSparkTestFactory.create({
            app
        });
        await axiSparkCore.init();
        await axiSparkCore.run();
    });

    beforeEach(() => {
        socket = io('http://localhost:3000', {
            path: '/websocket'
        });
    });

    afterEach(() => {
        socket.disconnect();
    });

    it('should create the app with the HTTP and WebSocket plugins', () => {
        const plugins = axiSparkCore.used().map((plugin) => plugin.type);
        expect(plugins).toEqual([HttpPlugin, WebSocketPlugin]);
    });

    it('should answer a successful HTTP request', async () => {
        const response = await fetch('http://localhost:3000/api/users/1');
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ id: '1', name: 'Ada' });
    });

    it('should answer an HttpError with its status and body', async () => {
        const response = await fetch('http://localhost:3000/api/users/2');
        expect(response.status).toBe(404);
        expect(await response.json()).toEqual(expect.objectContaining({ error: 'User 2 not found', status: 404 }));
    });

    it('should answer an unexpected HTTP error with a 500 status and body', async () => {
        const response = await fetch('http://localhost:3000/api/users/fail/unexpected');
        expect(response.status).toBe(500);
        expect(await response.json()).toEqual(expect.objectContaining({ error: 'Unexpected failure', status: 500 }));
    });

    it('should answer a request to an unknown route with a 404 status', async () => {
        const response = await fetch('http://localhost:3000/api/unknown');
        expect(response.status).toBe(404);
    });

    it('should acknowledge a successful WebSocket event', async () => {
        expect(await emit('user', { id: '1' })).toEqual({ id: '1', name: 'Ada' });
    });

    it('should acknowledge a WebSocketError with its status and description', async () => {
        expect(await emit('user', { id: '2' })).toEqual({ error: 'User 2 not found', status: 4004, description: 'Unknown user' });
    });

    it('should acknowledge an unexpected WebSocket error with the event name', async () => {
        expect(await emit('fail')).toEqual({ error: 'Unexpected failure', status: 1, description: "Event 'fail'" });
    });

    afterAll(async () => {
        await axiSparkCore.destroy();
    });
});
