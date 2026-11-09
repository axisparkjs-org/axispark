import { WebSocket, WebSocketError, WebSocketEvent, WsData } from '@axisparkjs/websocket';

@WebSocket()
export class UserWebSocket {
    @WebSocketEvent('user')
    public async onUser(@WsData() data: { id: string }) {
        if (data?.id !== '1') throw new WebSocketError(`User ${data?.id} not found`, 4004, { description: 'Unknown user' });
        return { id: data.id, name: 'Ada' };
    }

    @WebSocketEvent('fail')
    public async onFail() {
        throw new Error('Unexpected failure');
    }
}
