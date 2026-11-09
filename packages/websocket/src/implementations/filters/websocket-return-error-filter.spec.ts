import { WebSocketReturnErrorFilter } from './websocket-return-error-filter';
import { WebSocketError } from '../errors';

describe('WebSocketReturnErrorFilter', () => {
    it('returns WebSocket errors unchanged', async () => {
        const error = new WebSocketError('bad', 4, { description: 'detail' });
        expect((await new WebSocketReturnErrorFilter().error(error, { message: { event: 'ping' } } as any)).value).toBe(error);
    });
    it('wraps ordinary errors with the event name', async () => {
        const result: any = await new WebSocketReturnErrorFilter().error(new Error('oops'), { message: { event: 'ping' } } as any);
        expect(result.value).toMatchObject({ message: 'oops', options: { description: "Event 'ping'" } });
        const withoutMessage: any = await new WebSocketReturnErrorFilter().error(new Error('oops'), {} as any);
        expect(withoutMessage.value.options.description).toBe("Event 'undefined'");
    });
});
