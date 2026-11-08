import {
    WebSocket,
    WebSocketConnection,
    WebSocketContext,
    WebSocketEvent,
    WebSocketMessage,
    WsAck,
    WsConnection,
    WsData,
    WsMessage
} from '@axisparkjs/websocket';
import { Context, Timeout } from '@axisparkjs/engine';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@WebSocket()
export class ChatWebSocket {
    @WebSocketEvent('message')
    public async onMessage(@WsData() data: any) {
        return { message: `Received message`, data };
    }

    @WebSocketEvent('message-ack')
    public async onMessageWithAck(@WsData() data: any, @WsAck() ack: (response: unknown) => void) {
        ack({ message: 'Received message ack', data });
    }

    @WebSocketEvent('context')
    public async onContext(@Context() context: WebSocketContext, @WsMessage() message: WebSocketMessage, @WsConnection() connection: WebSocketConnection) {
        return {
            context: context !== undefined,
            message: message !== undefined,
            connection: connection !== undefined,
            containsEq: context?.connection === connection && context?.message === message
        };
    }

    @WebSocketEvent(/^user:\w+$/)
    public async onUserEvent(@WsMessage() message: WebSocketMessage) {
        return { event: message.event, data: message.data };
    }

    @WebSocketEvent('connection')
    public async onConnection(@WsConnection() connection: WebSocketConnection) {
        const data = { message: 'Connection event', connectionId: connection.id };

        connection.emit('connection-event', data);
    }
}

@WebSocket('/chat-v2')
export class ChatWebSocketV2 {
    @WebSocketEvent('message')
    public async onMessage(@WsData() data: any) {
        return { message: `Received message v2`, data };
    }

    @WebSocketEvent('connection')
    public async onConnection(@WsConnection() connection: WebSocketConnection) {
        const data = { message: 'Connection event', connectionId: connection.id };

        connection.emit('connection-event-v2', data);
    }
}

@WebSocket('/timeouts')
export class TimeoutWebSocket {
    @WebSocketEvent('slow')
    @Timeout(100)
    public async onSlow() {
        await wait(400);
        return { done: true };
    }

    @WebSocketEvent('fast')
    @Timeout(500)
    public async onFast() {
        await wait(50);
        return { done: true };
    }

    @WebSocketEvent('default-timeout')
    public async onDefaultTimeout() {
        await wait(500);
        return { done: true };
    }
}
