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
import { Context } from '@axisparkjs/engine';

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
