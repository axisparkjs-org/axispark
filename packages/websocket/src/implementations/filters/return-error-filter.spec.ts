import { ReturnErrorFilter } from './return-error-filter';
import { WebSocketError, WebSocketRequestTimeoutError } from '../errors';

describe('ReturnErrorFilter', () => {
    it('returns WebSocket errors unchanged', async () => {
        const error = new WebSocketError('bad', 4, { description: 'detail' });
        expect((await new ReturnErrorFilter().error(error, { message: { event: 'ping' } } as any)).value).toBe(error);
    });
    it('wraps ordinary errors with the event name', async () => {
        const result: any = await new ReturnErrorFilter().error(new Error('oops'), { message: { event: 'ping' } } as any);
        expect(result.value).toMatchObject({ message: 'oops', options: { description: "Event 'ping'" } });
        const withoutMessage: any = await new ReturnErrorFilter().error(new Error('oops'), {} as any);
        expect(withoutMessage.value.options.description).toBe("Event 'undefined'");
    });
    it('adds the event name to timeout errors without a description', async () => {
        const result: any = await new ReturnErrorFilter().error(new WebSocketRequestTimeoutError('Request timed out after 100ms'), {
            message: { event: 'slow' }
        } as any);
        expect(result.value).toBeInstanceOf(WebSocketRequestTimeoutError);
        expect(result.value).toMatchObject({ response: 'Request timed out after 100ms', status: 408, options: { description: "Event 'slow'" } });
    });
});
