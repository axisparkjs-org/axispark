import { Server } from 'socket.io';
import { SocketIOWebSocketAdapter } from './socketio-websocket-adapter';
import { SocketIOWebSocketConnection } from '../types/socketio-websocket-connection';

jest.mock('socket.io', () => ({
    Server: jest.fn().mockImplementation(() => {
        const namespaces = new Map<string, any>();
        return {
            of: jest.fn((name: string) => {
                if (!namespaces.has(name)) {
                    namespaces.set(name, { on: jest.fn() });
                }
                return namespaces.get(name);
            }),
            listen: jest.fn(),
            close: jest.fn().mockResolvedValue(undefined)
        };
    })
}));

describe('SocketIOWebSocketAdapter', () => {
    const createAdapter = (options: any) => {
        const adapter = new SocketIOWebSocketAdapter(options);
        adapter.initialize?.();
        return { adapter, io: (adapter as any).io as jest.Mocked<Server> };
    };

    it('initializes with the HTTP server and Socket.IO options', () => {
        const httpServer = {} as any;
        const adapter = new SocketIOWebSocketAdapter({
            useHttpPluginServer: true,
            connectTimeout: 100,
            path: '/ws',
            serveClient: false
        } as any);

        adapter.initialize?.(httpServer);

        expect(Server).toHaveBeenLastCalledWith(httpServer, {
            connectTimeout: 100,
            path: '/ws',
            serveClient: false
        });
    });

    it('registers namespaces, runs connection handlers, and dispatches message handlers', async () => {
        const { adapter, io } = createAdapter({ useHttpPluginServer: false } as any);
        const connectionHandler = jest.fn();
        const chatHandler = jest.fn();
        const regexHandler = jest.fn();
        const otherHandler = jest.fn();
        const events = [
            { namespace: '/chat', event: 'connection', handler: connectionHandler },
            { namespace: '/chat', event: 'chat', handler: chatHandler },
            { namespace: '/chat', event: /^user:\w+$/gi, handler: regexHandler },
            { namespace: '/other', event: 'message', handler: otherHandler }
        ] as any;

        adapter.registerEvents(events);

        expect(adapter.getRegisteredEvents()).toEqual(events);
        expect(io.of).toHaveBeenCalledWith('/chat');
        expect(io.of).toHaveBeenCalledWith('/other');
        const chatNamespace = io.of('/chat') as any;
        const connect = chatNamespace.on.mock.calls[0][1] as (socket: any) => Promise<void>;
        const listeners: Record<string, (data: unknown, ack?: (response?: unknown) => void) => Promise<void>> = {};
        let anyListener: ((eventName: string, ...args: unknown[]) => Promise<void>) | undefined;
        const socket = {
            on: jest.fn((name: string, handler: any) => {
                listeners[name] = handler;
            }),
            onAny: jest.fn((handler: typeof anyListener) => {
                anyListener = handler;
            }),
            id: 'socket-id',
            nsp: { name: '/chat' },
            rooms: new Set<string>(),
            connected: true
        } as any;

        await connect(socket);

        expect(connectionHandler).toHaveBeenCalledWith({
            connection: expect.any(SocketIOWebSocketConnection),
            message: undefined
        });
        const ack = jest.fn();
        await listeners.chat(1, ack);
        expect(chatHandler).toHaveBeenCalledWith(
            expect.objectContaining({
                connection: expect.any(SocketIOWebSocketConnection),
                message: expect.objectContaining({ event: 'chat', data: 1, ack })
            })
        );
        const regexAck = jest.fn();
        await anyListener?.('USER:CREATED', { id: 7 }, regexAck);
        expect(regexHandler).toHaveBeenCalledWith(
            expect.objectContaining({
                connection: expect.any(SocketIOWebSocketConnection),
                message: expect.objectContaining({ event: 'USER:CREATED', data: { id: 7 }, ack: regexAck })
            })
        );
        await anyListener?.('USER:UPDATED', { id: 7 }, regexAck);
        expect(regexHandler).toHaveBeenCalledTimes(2);
        expect(socket.on).toHaveBeenCalledTimes(1);
        expect(socket.onAny).toHaveBeenCalledTimes(1);
    });

    it('evaluates unanchored global regexes from the start of each event and restores their state', async () => {
        const { adapter, io } = createAdapter({ useHttpPluginServer: false } as any);
        const pattern = /user:\w+/g;
        pattern.lastIndex = 4;
        const regexHandler = jest.fn();
        adapter.registerEvents([{ namespace: '/events', event: pattern, handler: regexHandler }] as any);

        const namespace = io.of('/events') as any;
        const connect = namespace.on.mock.calls[0][1] as (socket: any) => Promise<void>;
        let anyListener: ((eventName: string, ...args: unknown[]) => Promise<void>) | undefined;
        const socket = { on: jest.fn(), onAny: jest.fn((handler: typeof anyListener) => (anyListener = handler)) };
        await connect(socket);

        await anyListener?.('user:created', {});
        await anyListener?.('user:updated', {});
        await anyListener?.('prefix:user:created', {});

        expect(regexHandler).toHaveBeenCalledTimes(3);
        expect(pattern.lastIndex).toBe(4);
    });

    it('handles namespaces without connection events and an empty registration', async () => {
        const { adapter, io } = createAdapter({ useHttpPluginServer: false } as any);
        const messageHandler = jest.fn();
        adapter.registerEvents([{ namespace: '/events', event: 'update', handler: messageHandler }] as any);
        adapter.registerEvents([]);

        expect(io.of).toHaveBeenCalledTimes(1);
        const namespace = io.of('/events') as any;
        const connect = namespace.on.mock.calls[0][1] as (socket: any) => Promise<void>;
        const socket = { on: jest.fn(), onAny: jest.fn() };
        await connect(socket);

        expect(socket.on).toHaveBeenCalledWith('update', expect.any(Function));
        await adapter.stop();
        expect(io.close).toHaveBeenCalled();
    });

    it('skips an event when its namespace bucket is unavailable', () => {
        const { adapter, io } = createAdapter({ useHttpPluginServer: false } as any);
        const originalGet = Map.prototype.get;
        let getCalls = 0;
        const get = jest.spyOn(Map.prototype, 'get').mockImplementation(function (this: Map<any, any>, key: any) {
            getCalls += 1;
            return getCalls === 1 ? undefined : originalGet.call(this, key);
        });

        try {
            adapter.registerEvents([{ namespace: '/missing', event: 'ignored', handler: jest.fn() }] as any);
        } finally {
            get.mockRestore();
        }

        expect(io.of).toHaveBeenCalledWith('/missing');
        expect((io.of('/missing') as any).on).toHaveBeenCalledWith('connection', expect.any(Function));
    });

    it('starts on the configured port and skips listening when using the HTTP plugin server', async () => {
        const { adapter, io } = createAdapter({ useHttpPluginServer: false, port: 9000 } as any);
        await adapter.start();
        expect(io.listen).toHaveBeenCalledWith(9000);

        const defaultPortAdapter = new SocketIOWebSocketAdapter({ useHttpPluginServer: false } as any);
        defaultPortAdapter.initialize?.();
        const defaultPortIo = (defaultPortAdapter as any).io;
        await defaultPortAdapter.start();
        expect(defaultPortIo.listen).toHaveBeenCalledWith(3000);

        const httpAdapter = new SocketIOWebSocketAdapter({ useHttpPluginServer: true } as any);
        httpAdapter.initialize?.({} as any);
        const httpIo = (httpAdapter as any).io;
        await httpAdapter.start();
        expect(httpIo.listen).not.toHaveBeenCalled();
    });
});
