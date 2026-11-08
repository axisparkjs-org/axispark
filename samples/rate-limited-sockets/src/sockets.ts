import { NoRateLimit, RateLimit } from '@axisparkjs/engine';
import { WebSocket, WebSocketEvent, WsData } from '@axisparkjs/websocket';

@WebSocket()
export class ChatSockets {
    private sent = 0;

    /** Limited to 3 messages every 10 seconds per client, overriding the default limits of the plugin. */
    @WebSocketEvent('chat:send')
    @RateLimit({ ttl: 10_000, limit: 3 })
    send(@WsData() message: { text: string }) {
        this.sent++;
        return { received: message.text };
    }

    /** Limited by the default options of the plugin: 5 events every 10 seconds per client. */
    @WebSocketEvent('ping')
    ping() {
        return { pong: true };
    }

    /** Never limited. Returns the number of messages that reached the `chat:send` handler. */
    @WebSocketEvent('chat:sent')
    @NoRateLimit()
    count() {
        return { sent: this.sent };
    }
}
