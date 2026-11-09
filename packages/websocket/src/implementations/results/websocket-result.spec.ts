import { OkWebSocketResult, ErrorWebSocketResult } from './websocket-result';
import { WebSocketError, WebSocketRateLimitExceededError } from '../errors';

describe('WebSocket results', () => {
    it('acknowledges successful values when an ack exists', async () => {
        const ack = jest.fn();
        await new OkWebSocketResult('ok').process({ message: { ack } } as any);
        expect(ack).toHaveBeenCalledWith('ok');
        await new OkWebSocketResult('ignored').process({} as any);
    });
    it('acknowledges error details and supports missing acknowledgements', async () => {
        const ack = jest.fn();
        await new ErrorWebSocketResult(new WebSocketError('bad', 4, { description: 'detail' })).process({ message: { ack } } as any);
        expect(ack).toHaveBeenCalledWith({ error: 'bad', status: 4, description: 'detail' });
        await new ErrorWebSocketResult(new WebSocketError('plain')).process({ message: { ack } } as any);
        await new ErrorWebSocketResult(new WebSocketError('no ack')).process({} as any);
    });
    it('acknowledges the details of the error, such as the retry time of the rate limits', async () => {
        const ack = jest.fn();
        await new ErrorWebSocketResult(new WebSocketRateLimitExceededError(750)).process({ message: { ack } } as any);
        expect(ack).toHaveBeenCalledWith({ error: 'Too many requests. Please try again later.', status: 429, description: undefined, retryAfterMs: 750 });
    });
});
