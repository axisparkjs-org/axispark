import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { WebSocketEvent } from './websocket-event';

describe('WebSocketEvent', () => {
    it('stores event metadata on the class and method', () => {
        class Controller {
            handle() {}
        }
        const descriptor = Object.getOwnPropertyDescriptor(Controller.prototype, 'handle') as PropertyDescriptor;
        WebSocketEvent('message')(Controller.prototype, 'handle', descriptor);
        WebSocketEvent('message:again')(Controller.prototype, 'handle', descriptor);
        expect(Metadata.get(MetadataKeys.WEBSOCKET_EVENT, Controller)).toHaveLength(2);
        expect(Metadata.get(MetadataKeys.WEBSOCKET_EVENT, Controller, 'handle')).toMatchObject({ event: 'message:again' });
    });

    it('stores regular expression event metadata', () => {
        class Controller {
            handle() {}
        }
        const descriptor = Object.getOwnPropertyDescriptor(Controller.prototype, 'handle') as PropertyDescriptor;
        const event = /^user:\w+$/i;

        WebSocketEvent(event)(Controller.prototype, 'handle', descriptor);

        expect(Metadata.get(MetadataKeys.WEBSOCKET_EVENT, Controller)).toMatchObject([{ event }]);
        expect(Metadata.get(MetadataKeys.WEBSOCKET_EVENT, Controller, 'handle')).toMatchObject({ event });
    });
});
