import { WebSocketEventDefinition } from './websocket-event-definition';

describe('WebSocketEventDefinition', () => {
    it('keeps its handler target, event, and namespace details', () => {
        class Controller {}
        const handler = jest.fn();
        const definition = new WebSocketEventDefinition(Controller, 'handle', '/chat', 'message', handler);
        expect(definition).toMatchObject({ target: Controller, propertyKey: 'handle', namespace: '/chat', event: 'message', handler });
    });

    it('keeps a regular expression event pattern', () => {
        class Controller {}
        const event = /^user:\w+$/;
        const definition = new WebSocketEventDefinition(Controller, 'handle', '/chat', event, jest.fn());

        expect(definition.event).toBe(event);
    });
});
