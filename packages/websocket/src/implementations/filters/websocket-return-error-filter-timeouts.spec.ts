import { WebSocketReturnErrorFilter } from './websocket-return-error-filter';
import { WebSocketRequestTimeoutError } from '../errors';

describe('WebSocketReturnErrorFilter timeouts', () => {
    it('adds the event name to timeout errors without a description', async () => {
        const result: any = await new WebSocketReturnErrorFilter().error(new WebSocketRequestTimeoutError('Request timed out after 100ms'), {
            message: { event: 'slow' }
        } as any);
        expect(result.value).toBeInstanceOf(WebSocketRequestTimeoutError);
        expect(result.value).toMatchObject({ response: 'Request timed out after 100ms', status: 408, options: { description: "Event 'slow'" } });
    });
});
