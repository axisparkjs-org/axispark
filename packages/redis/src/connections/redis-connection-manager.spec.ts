import { EventEmitter } from 'node:events';
import { createClient } from 'redis';
import { RedisConnectionManager } from './redis-connection-manager';

jest.mock('redis', () => ({
    createClient: jest.fn()
}));

const createClientMock = jest.mocked(createClient);

class ClientMock extends EventEmitter {
    isOpen = false;
    connect = jest.fn(() => {
        this.isOpen = true;
        return Promise.resolve(this);
    });
    close = jest.fn(() => {
        this.isOpen = false;
        return Promise.resolve();
    });
    destroy = jest.fn(() => {
        this.isOpen = false;
    });
}

describe('RedisConnectionManager', () => {
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

    beforeEach(() => {
        jest.resetAllMocks();
    });

    const mockClients = (...clients: ClientMock[]) => {
        for (const client of clients) createClientMock.mockReturnValueOnce(client as any);
    };
    const createManager = (connections: any[], options: Record<string, unknown> = {}) =>
        new RedisConnectionManager({ connections, ...options } as any, logger as any);

    it('creates and connects all configured connections and passes their settings through', async () => {
        const first = new ClientMock();
        const second = new ClientMock();
        mockClients(first, second);
        const manager = createManager([
            { name: 'CACHE', url: 'redis://localhost:6379/0', options: { socket: { connectTimeout: 5000 } } },
            { name: 'LOCKS', url: 'redis://localhost:6379/1' }
        ]);

        await manager.createConnections();

        expect(createClientMock).toHaveBeenNthCalledWith(1, { socket: { connectTimeout: 5000 }, url: 'redis://localhost:6379/0' });
        expect(createClientMock).toHaveBeenNthCalledWith(2, { url: 'redis://localhost:6379/1' });
        expect(first.connect).toHaveBeenCalledTimes(1);
        expect(second.connect).toHaveBeenCalledTimes(1);
        expect(manager.getConnection('CACHE')).toBe(first);
        expect(manager.getConnection('LOCKS')).toBe(second);
        for (const client of [first, second]) {
            expect(client.listenerCount('ready')).toBe(1);
            expect(client.listenerCount('reconnecting')).toBe(1);
            expect(client.listenerCount('error')).toBe(1);
            expect(client.listenerCount('end')).toBe(1);
        }
    });

    it('uses the url of the connection instead of the url of the client options', async () => {
        mockClients(new ClientMock());
        const manager = createManager([{ name: 'CACHE', url: 'redis://cache:6379', options: { url: 'redis://ignored:6379' } }]);

        await manager.createConnections();

        expect(createClientMock).toHaveBeenCalledWith({ url: 'redis://cache:6379' });
    });

    it('logs the ready, reconnecting, error and end events', async () => {
        const client = new ClientMock();
        mockClients(client);
        const manager = createManager([{ name: 'CACHE', url: 'redis://localhost:6379' }]);
        await manager.createConnections();
        const error = new Error('connect ECONNREFUSED 127.0.0.1:6379');

        client.emit('ready');
        client.emit('reconnecting');
        client.emit('error', error);
        client.emit('end');

        expect(logger.info).toHaveBeenCalledWith("Connection 'CACHE' established");
        expect(logger.warn).toHaveBeenCalledWith("Connection 'CACHE' reconnecting");
        expect(logger.error).toHaveBeenCalledWith("Connection 'CACHE' encountered an error", error);
        expect(logger.info).toHaveBeenCalledWith("Connection 'CACHE' finished");
    });

    it('does not wait for the connections and ignores the connect rejections by default', async () => {
        const client = new ClientMock();
        client.connect.mockImplementation(() => Promise.reject(new Error('connect ECONNREFUSED')));
        mockClients(client);
        const manager = createManager([{ name: 'CACHE', url: 'redis://localhost:6379' }]);

        await expect(manager.createConnections()).resolves.toBeUndefined();

        expect(manager.getConnection('CACHE')).toBe(client);
    });

    it('waits for every connection when failOnConnectError is enabled', async () => {
        const first = new ClientMock();
        const second = new ClientMock();
        mockClients(first, second);
        const manager = createManager(
            [
                { name: 'CACHE', url: 'redis://localhost:6379/0' },
                { name: 'LOCKS', url: 'redis://localhost:6379/1' }
            ],
            { failOnConnectError: true }
        );

        await expect(manager.createConnections()).resolves.toBeUndefined();

        expect(first.listenerCount('error')).toBe(1);
        expect(second.listenerCount('error')).toBe(1);
        expect(manager.getAllConnections().size).toBe(2);
    });

    it('fails with the first connection error and stops reconnecting when failOnConnectError is enabled', async () => {
        const client = new ClientMock();
        client.connect.mockImplementation(() => new Promise(() => undefined));
        mockClients(client);
        const manager = createManager([{ name: 'CACHE', url: 'redis://localhost:6379' }], { failOnConnectError: true });
        const error = new Error('connect ECONNREFUSED 127.0.0.1:6379');

        const created = manager.createConnections();
        client.emit('error', error);

        await expect(created).rejects.toThrow("Connection 'CACHE' could not be established: connect ECONNREFUSED 127.0.0.1:6379");
        await expect(created).rejects.toMatchObject({ cause: error });
        expect(client.destroy).toHaveBeenCalledTimes(1);
        expect(logger.error).toHaveBeenCalledWith("Connection 'CACHE' encountered an error", error);
        expect(manager.getConnection('CACHE')).toBeUndefined();
    });

    it('ignores the connect rejection after the error was reported when failOnConnectError is enabled', async () => {
        const client = new ClientMock();
        const error = new Error('connect ECONNREFUSED 127.0.0.1:6379');
        client.connect.mockImplementation(() => {
            client.emit('error', error);
            return Promise.reject(error);
        });
        mockClients(client);
        const manager = createManager([{ name: 'CACHE', url: 'redis://localhost:6379' }], { failOnConnectError: true });

        await expect(manager.createConnections()).rejects.toThrow("Connection 'CACHE' could not be established");
    });

    it('creates independent named connections when they share a URL', async () => {
        const first = new ClientMock();
        const second = new ClientMock();
        mockClients(first, second);
        const url = 'redis://shared-host:6379';
        const manager = createManager([
            { name: 'PUBLISHER', url },
            { name: 'SUBSCRIBER', url }
        ]);

        await manager.createConnections();

        expect(manager.getConnection('PUBLISHER')).toBe(first);
        expect(manager.getConnection('SUBSCRIBER')).toBe(second);
        expect(first).not.toBe(second);
    });

    it('does not create a second connection with a duplicate name', async () => {
        mockClients(new ClientMock(), new ClientMock());
        const manager = createManager([
            { name: 'CACHE', url: 'redis://one:6379' },
            { name: 'CACHE', url: 'redis://two:6379' }
        ]);

        await expect(manager.createConnections()).rejects.toThrow("Connection with name 'CACHE' already exists. Connection names must be unique.");
        expect(createClientMock).toHaveBeenCalledTimes(1);
    });

    it('returns undefined for unknown names and a defensive copy of all connections', async () => {
        const client = new ClientMock();
        mockClients(client);
        const manager = createManager([{ name: 'CACHE', url: 'redis://localhost:6379' }]);
        await manager.createConnections();

        manager.getAllConnections().clear();

        expect(manager.getConnection('MISSING')).toBeUndefined();
        expect(manager.getConnection('CACHE')).toBe(client);
    });

    it('closes the open connections and removes every managed connection', async () => {
        const open = new ClientMock();
        const closed = new ClientMock();
        closed.connect.mockImplementation(() => Promise.reject(new Error('closed')));
        mockClients(open, closed);
        const manager = createManager([
            { name: 'CACHE', url: 'redis://localhost:6379/0' },
            { name: 'LOCKS', url: 'redis://localhost:6379/1' }
        ]);
        await manager.createConnections();

        await manager.destroyConnections();

        expect(open.close).toHaveBeenCalledTimes(1);
        expect(closed.close).not.toHaveBeenCalled();
        expect(manager.getAllConnections().size).toBe(0);
    });

    it('allows a connection name to be reused after the connection was destroyed', async () => {
        const first = new ClientMock();
        const second = new ClientMock();
        mockClients(first, second);
        const manager = createManager([{ name: 'CACHE', url: 'redis://localhost:6379' }]);

        await manager.createConnections();
        await manager.destroyConnections();
        await manager.createConnections();

        expect(createClientMock).toHaveBeenCalledTimes(2);
        expect(first.close).toHaveBeenCalledTimes(1);
        expect(manager.getConnection('CACHE')).toBe(second);
    });

    it('allows creation and destruction when no connections are configured', async () => {
        const manager = createManager([]);

        await expect(manager.createConnections()).resolves.toBeUndefined();
        await expect(manager.destroyConnections()).resolves.toBeUndefined();
        expect(createClientMock).not.toHaveBeenCalled();
    });
});
