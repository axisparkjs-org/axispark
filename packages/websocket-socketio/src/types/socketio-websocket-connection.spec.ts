import { EventEmitter } from 'node:events';
import { ClientDisconnectedError } from '@axisparkjs/engine';
import { SocketIOWebSocketConnection } from './socketio-websocket-connection';

describe('SocketIOWebSocketConnection', () => {
    it('forwards connection operations to socket', () => {
        const socket: any = {
            id: 'id',
            nsp: { name: '/room' },
            rooms: new Set(['a', 'b']),
            connected: true,
            emit: jest.fn(),
            join: jest.fn(),
            leave: jest.fn(),
            to: jest.fn().mockReturnValue({ emit: jest.fn() }),
            disconnect: jest.fn()
        };
        const connection = new SocketIOWebSocketConnection(socket);
        expect(connection.id).toBe('id');
        expect(connection.namespace).toBe('/room');
        expect(connection.rooms).toEqual(['a', 'b']);
        expect(connection.connected).toBe(true);
        connection.emit('x', 1);
        connection.join('a');
        connection.leave('b');
        connection.broadcast('r', 'y', 2);
        connection.close(3, 'bye');
        expect(socket.emit).toHaveBeenCalledWith('x', 1);
        expect(socket.join).toHaveBeenCalledWith('a');
        expect(socket.leave).toHaveBeenCalledWith('b');
        expect(socket.to).toHaveBeenCalledWith('r');
        expect(socket.disconnect).toHaveBeenCalledWith(true);
    });

    it('returns the address of the handshake as the remote address', () => {
        const socket: any = { handshake: { address: '10.0.0.1', headers: { 'x-forwarded-for': '203.0.113.7' } } };

        expect(new SocketIOWebSocketConnection(socket).remoteAddress).toBe('10.0.0.1');
        expect(new SocketIOWebSocketConnection(socket, () => true).remoteAddress).toBe('203.0.113.7');
        expect(new SocketIOWebSocketConnection({ handshake: { address: '' } } as any).remoteAddress).toBeUndefined();
        expect(new SocketIOWebSocketConnection({} as any).remoteAddress).toBeUndefined();
    });

    it('should share one signal per socket, aborted when the socket is disconnected', () => {
        const socket: any = Object.assign(new EventEmitter(), { disconnected: false });
        const first = new SocketIOWebSocketConnection(socket).signal;
        const second = new SocketIOWebSocketConnection(socket).signal;

        expect(second).toBe(first);
        expect(socket.listenerCount('disconnect')).toBe(1);

        socket.emit('disconnect');

        expect(first.aborted).toBe(true);
        expect(first.reason).toBeInstanceOf(ClientDisconnectedError);
    });

    it('should return an aborted signal for a disconnected socket', () => {
        const socket: any = Object.assign(new EventEmitter(), { disconnected: true });

        expect(new SocketIOWebSocketConnection(socket).signal.aborted).toBe(true);
    });
});
