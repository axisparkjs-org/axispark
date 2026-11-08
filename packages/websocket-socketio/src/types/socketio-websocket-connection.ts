import { WebSocketConnection } from '@axisparkjs/websocket';
import { Socket } from 'socket.io';
import { resolveClientAddress, TrustProxyFunction } from '../adapter/trust-proxy';

export class SocketIOWebSocketConnection implements WebSocketConnection {
    /**
     * @param socket The Socket.IO socket.
     * @param trustProxy The function that decides which proxies are trusted to resolve the client address from the `X-Forwarded-For`
     * header of the handshake. Without it, the address is the address of the socket.
     */
    constructor(
        private readonly socket: Socket,
        private readonly trustProxy?: TrustProxyFunction
    ) {}

    get id(): string {
        return this.socket.id;
    }

    get remoteAddress(): string | undefined {
        const handshake = this.socket.handshake;
        return resolveClientAddress(handshake?.address || undefined, handshake?.headers ?? {}, this.trustProxy);
    }

    get namespace(): string | undefined {
        return this.socket.nsp.name;
    }

    get rooms(): readonly string[] {
        return Array.from(this.socket.rooms);
    }

    emit<TData = unknown>(event: string, data?: TData): void {
        this.socket.emit(event, data);
    }

    join(room: string): void {
        this.socket.join(room);
    }

    leave(room: string): void {
        this.socket.leave(room);
    }

    broadcast<TData = unknown>(room: string, event: string, data?: TData): void {
        this.socket.to(room).emit(event, data);
    }

    close(_code?: number, _reason?: string): void {
        this.socket.disconnect(true);
    }

    get connected(): boolean {
        return this.socket.connected;
    }
}
