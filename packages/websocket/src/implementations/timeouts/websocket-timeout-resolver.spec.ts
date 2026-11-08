import { TimeoutDefinition } from '@axisparkjs/engine';
import { WebSocketTimeoutResolver } from './websocket-timeout-resolver';
import { WebSocketError, WebSocketRequestTimeoutError } from '../errors';

describe('WebSocketTimeoutResolver', () => {
    const createTimeout = (time: number): TimeoutDefinition => ({ time }) as TimeoutDefinition;
    const options = (timeoutOptions?: any): any => ({ timeoutOptions });

    it('should throw a WebSocketRequestTimeoutError with a default message indicating the timeout', async () => {
        const resolver = new WebSocketTimeoutResolver(options());

        await expect(resolver.resolve(createTimeout(5000))).rejects.toThrow(WebSocketRequestTimeoutError);
        await expect(resolver.resolve(createTimeout(5000))).rejects.toThrow(WebSocketError);
        await expect(resolver.resolve(createTimeout(5000))).rejects.toThrow('Request timed out after 5000ms');
        await expect(resolver.resolve(createTimeout(5000))).rejects.toMatchObject({ status: 408 });
    });

    it('should use the default message without options', async () => {
        const resolver = new WebSocketTimeoutResolver();

        await expect(resolver.resolve(createTimeout(3000))).rejects.toThrow('Request timed out after 3000ms');
    });

    it('should use the configured message', async () => {
        const resolver = new WebSocketTimeoutResolver(options({ message: 'Too slow' }));

        await expect(resolver.resolve(createTimeout(3000))).rejects.toThrow('Too slow');
    });

    it('should use the configured message function with the time', async () => {
        const resolver = new WebSocketTimeoutResolver(options({ message: (time: number) => `Event timed out after ${time} ms` }));

        await expect(resolver.resolve(createTimeout(100))).rejects.toThrow('Event timed out after 100 ms');
    });
});
