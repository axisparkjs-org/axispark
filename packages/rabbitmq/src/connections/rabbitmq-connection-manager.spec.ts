import { connect } from 'amqp-connection-manager';
import { RabbitMQConnectionManager } from './rabbitmq-connection-manager';

jest.mock('amqp-connection-manager', () => ({
    connect: jest.fn()
}));

const connectMock = jest.mocked(connect);

describe('RabbitMQConnectionManager', () => {
    const logger = { info: jest.fn(), error: jest.fn() };

    beforeEach(() => {
        jest.resetAllMocks();
    });

    const createManager = (connections: any[]) => new RabbitMQConnectionManager({ connections } as any, logger as any);

    it('creates all configured connections and passes their settings through', async () => {
        const first = { close: jest.fn(), on: jest.fn() };
        const second = { close: jest.fn(), on: jest.fn() };
        connectMock.mockReturnValueOnce(first as any).mockReturnValueOnce(second as any);
        const configs = [
            { name: 'PRIMARY', url: 'amqp://primary', options: { heartbeatIntervalInSeconds: 10 } },
            { name: 'REPORTING', url: ['amqp://one', 'amqp://two'], options: {} }
        ];
        const manager = createManager(configs);

        await manager.createConnections();

        expect(connectMock).toHaveBeenNthCalledWith(1, configs[0].url, configs[0].options);
        expect(connectMock).toHaveBeenNthCalledWith(2, configs[1].url, configs[1].options);
        expect(manager.getConnection('PRIMARY')).toBe(first);
        expect(manager.getConnection('REPORTING')).toBe(second);
        expect(first.on).toHaveBeenCalledWith('connect', expect.any(Function));
        expect(first.on).toHaveBeenCalledWith('connectFailed', expect.any(Function));
        expect(first.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
        expect(second.on).toHaveBeenCalledWith('connect', expect.any(Function));
        expect(second.on).toHaveBeenCalledWith('connectFailed', expect.any(Function));
        expect(second.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    });

    it('logs connection, connection-failure, and disconnection events', async () => {
        const connection = { close: jest.fn(), on: jest.fn() };
        connectMock.mockReturnValue(connection as any);
        const manager = createManager([{ name: 'PRIMARY', url: 'amqp://primary' }]);

        await manager.createConnections();

        const connectHandler = connection.on.mock.calls.find(([event]) => event === 'connect')[1];
        const connectFailedHandler = connection.on.mock.calls.find(([event]) => event === 'connectFailed')[1];
        const disconnectHandler = connection.on.mock.calls.find(([event]) => event === 'disconnect')[1];
        const connectError = new Error('unable to connect');
        const disconnectError = new Error('connection dropped');

        connectHandler();
        connectFailedHandler({ err: connectError });
        disconnectHandler({ err: undefined });
        disconnectHandler({ err: disconnectError });

        expect(logger.info).toHaveBeenCalledWith("Connection 'PRIMARY' established");
        expect(logger.error).toHaveBeenCalledWith("Connection 'PRIMARY' encountered an error", connectError);
        expect(logger.info).toHaveBeenCalledWith("Connection 'PRIMARY' finished");
        expect(logger.error).toHaveBeenCalledWith("Connection 'PRIMARY' disconnected with error", disconnectError);
    });

    it('creates independent named connections when they share a URL', async () => {
        const first = { close: jest.fn(), on: jest.fn() };
        const second = { close: jest.fn(), on: jest.fn() };
        connectMock.mockReturnValueOnce(first as any).mockReturnValueOnce(second as any);
        const url = 'amqp://shared-host';
        const manager = createManager([
            { name: 'PUBLISHER', url },
            { name: 'CONSUMER', url }
        ]);

        await manager.createConnections();

        expect(connectMock).toHaveBeenNthCalledWith(1, url, undefined);
        expect(connectMock).toHaveBeenNthCalledWith(2, url, undefined);
        expect(manager.getConnection('PUBLISHER')).toBe(first);
        expect(manager.getConnection('CONSUMER')).toBe(second);
        expect(first).not.toBe(second);
    });

    it('propagates connection creation errors without registering a failed connection', async () => {
        const failure = new Error('broker unavailable');
        connectMock.mockImplementation(() => {
            throw failure;
        });
        const manager = createManager([{ name: 'PRIMARY', url: 'amqp://primary' }]);

        await expect(manager.createConnections()).rejects.toBe(failure);

        expect(manager.getConnection('PRIMARY')).toBeUndefined();
        expect(manager.getAllConnections()).toEqual(new Map());
    });

    it('allows a connection name to be reused after the connection was destroyed', async () => {
        const first = { close: jest.fn().mockResolvedValue(undefined), on: jest.fn() };
        const second = { close: jest.fn().mockResolvedValue(undefined), on: jest.fn() };
        connectMock.mockReturnValueOnce(first as any).mockReturnValueOnce(second as any);
        const manager = createManager([{ name: 'PRIMARY', url: 'amqp://primary' }]);

        await manager.createConnections();
        await manager.destroyConnections();
        await manager.createConnections();

        expect(connectMock).toHaveBeenCalledTimes(2);
        expect(first.close).toHaveBeenCalledTimes(1);
        expect(manager.getConnection('PRIMARY')).toBe(second);
    });

    it('does not create a second connection with a duplicate name', async () => {
        const connection = { close: jest.fn(), on: jest.fn() };
        connectMock.mockReturnValue(connection as any);
        const manager = createManager([
            { name: 'PRIMARY', url: 'amqp://one' },
            { name: 'PRIMARY', url: 'amqp://two' }
        ]);

        await expect(manager.createConnections()).rejects.toThrow("Connection with name 'PRIMARY' already exists. Connection names must be unique.");
        expect(connectMock).toHaveBeenCalledTimes(1);
    });

    it('returns undefined for unknown names and a defensive copy of all connections', async () => {
        const connection = { close: jest.fn(), on: jest.fn() };
        connectMock.mockReturnValue(connection as any);
        const manager = createManager([{ name: 'PRIMARY', url: 'amqp://primary' }]);
        await manager.createConnections();

        const allConnections = manager.getAllConnections();
        allConnections.clear();

        expect(manager.getConnection('MISSING')).toBeUndefined();
        expect(manager.getConnection('PRIMARY')).toBe(connection);
    });

    it('closes and removes every managed connection', async () => {
        const first = { close: jest.fn().mockResolvedValue(undefined), on: jest.fn() };
        const second = { close: jest.fn().mockResolvedValue(undefined), on: jest.fn() };
        connectMock.mockReturnValueOnce(first as any).mockReturnValueOnce(second as any);
        const manager = createManager([
            { name: 'PRIMARY', url: 'amqp://primary' },
            { name: 'REPORTING', url: 'amqp://reporting' }
        ]);
        await manager.createConnections();

        await manager.destroyConnections();

        expect(first.close).toHaveBeenCalledTimes(1);
        expect(second.close).toHaveBeenCalledTimes(1);
        expect(manager.getAllConnections().size).toBe(0);
    });

    it('allows creation and destruction when no connections are configured', async () => {
        const manager = createManager([]);

        await expect(manager.createConnections()).resolves.toBeUndefined();
        await expect(manager.destroyConnections()).resolves.toBeUndefined();
        expect(connectMock).not.toHaveBeenCalled();
    });
});
