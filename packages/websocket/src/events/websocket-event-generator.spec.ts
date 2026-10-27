import { ClassRegistry, ScopedContainerManager } from '@axisparkjs/di';
import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { ExecutionTransport } from '@axisparkjs/engine';
import { WebSocketEventGenerator } from './websocket-event-generator';
import { WebSocketEngine } from '../engine/websocket-engine';

describe('WebSocketEventGenerator', () => {
    afterEach(() => jest.restoreAllMocks());
    it('generates handlers with populated execution contexts', async () => {
        class Controller {
            handle() {}
        }
        const metadata = { target: Controller, propertyKey: 'handle', event: 'message' };
        Metadata.define(MetadataKeys.WEBSOCKET, { target: Controller, namespace: '/chat' }, Controller);
        Metadata.define(MetadataKeys.WEBSOCKET_EVENT, [metadata], Controller);
        jest.spyOn(ClassRegistry, 'getWithMetadata').mockReturnValue([Controller] as any);
        const manager = { create: jest.fn().mockReturnValue({ scoped: true }) };
        const engine = { execute: jest.fn() };
        const [definition] = await new WebSocketEventGenerator(engine as unknown as WebSocketEngine, manager as unknown as ScopedContainerManager).generate();
        expect(definition).toMatchObject({ target: Controller, propertyKey: 'handle', namespace: '/chat', event: 'message' });
        const context = { message: { event: 'message', data: null }, connection: { id: '1' } };
        await definition.handler(context as any);
        expect(engine.execute).toHaveBeenCalledWith(
            expect.objectContaining({
                ...context,
                target: Controller,
                propertyKey: 'handle',
                scopedContainer: { scoped: true },
                transport: ExecutionTransport.WebSocket,
                error: undefined
            })
        );
    });

    it('preserves regular expression event metadata in generated definitions', async () => {
        class Controller {
            handle() {}
        }
        const event = /^user:\w+$/;
        Metadata.define(MetadataKeys.WEBSOCKET, { target: Controller, namespace: '/chat' }, Controller);
        Metadata.define(MetadataKeys.WEBSOCKET_EVENT, [{ target: Controller, propertyKey: 'handle', event }], Controller);
        jest.spyOn(ClassRegistry, 'getWithMetadata').mockReturnValue([Controller] as any);

        const [definition] = await new WebSocketEventGenerator({ execute: jest.fn() } as any, { create: jest.fn() } as any).generate();

        expect(definition.event).toBe(event);
    });

    it('returns no definitions when no websocket classes are registered', async () => {
        jest.spyOn(ClassRegistry, 'getWithMetadata').mockReturnValue([] as any);
        expect(await new WebSocketEventGenerator({ execute: jest.fn() } as any, { create: jest.fn() } as any).generate()).toEqual([]);
    });
    it('skips websocket classes with no event metadata', async () => {
        class Empty {}
        Metadata.define(MetadataKeys.WEBSOCKET, { target: Empty, namespace: '/' }, Empty);
        jest.spyOn(ClassRegistry, 'getWithMetadata').mockReturnValue([Empty] as any);
        expect(await new WebSocketEventGenerator({ execute: jest.fn() } as any, { create: jest.fn() } as any).generate()).toEqual([]);
    });
});
