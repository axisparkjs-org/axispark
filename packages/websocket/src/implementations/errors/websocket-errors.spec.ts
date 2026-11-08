import { WebSocketError, WebSocketRequestTimeoutError } from './websocket-errors';

describe('WebSocketError', () => {
    it('should create an error with the given response message and default status', () => {
        const error = new WebSocketError('Something went wrong');

        expect(error.message).toBe('Something went wrong');
        expect(error.response).toBe('Something went wrong');
        expect(error.status).toBe(1);
        expect(error.options).toBeUndefined();
        expect(error.name).toBe('WebSocketError');
        expect(error).toBeInstanceOf(Error);
    });

    it('should create an error with a custom status code', () => {
        const error = new WebSocketError('Forbidden', 4003);

        expect(error.status).toBe(4003);
    });

    it('should create an error with options including cause and description', () => {
        const options = { cause: 'original error', description: 'Event connection' };
        const error = new WebSocketError('Error', 1, options);

        expect(error.options).toEqual(options);
    });
});

describe('WebSocketRequestTimeoutError', () => {
    it('should create a WebSocket error with the 408 status', () => {
        const error = new WebSocketRequestTimeoutError('Request timed out after 100ms');

        expect(error).toBeInstanceOf(WebSocketError);
        expect(error.response).toBe('Request timed out after 100ms');
        expect(error.status).toBe(408);
        expect(error.name).toBe('WebSocketRequestTimeoutError');
    });

    it('should use a default message', () => {
        expect(new WebSocketRequestTimeoutError().response).toBe('Request timed out');
    });
});
