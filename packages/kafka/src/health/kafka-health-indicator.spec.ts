import { HealthStatus } from '@axisparkjs/core';
import { KafkaHealthIndicator } from './kafka-health-indicator';

describe('KafkaHealthIndicator', () => {
    const createConnection = () => {
        const admin = {
            connect: jest.fn().mockResolvedValue(undefined),
            describeCluster: jest.fn().mockResolvedValue({
                clusterId: 'cluster',
                controller: 1,
                brokers: [{ nodeId: 1, host: 'localhost', port: 9092 }]
            }),
            disconnect: jest.fn().mockResolvedValue(undefined)
        };
        return { connection: { admin: jest.fn().mockReturnValue(admin) }, admin };
    };

    it('describes the cluster with an admin client without retries', async () => {
        const { connection, admin } = createConnection();

        await expect(new KafkaHealthIndicator(connection as any).check()).resolves.toEqual({
            status: HealthStatus.Healthy,
            details: { clusterId: 'cluster', brokers: 1, controller: 1 }
        });
        expect(connection.admin).toHaveBeenCalledWith({ retry: { retries: 0 } });
        expect(admin.connect).toHaveBeenCalledTimes(1);
        expect(admin.disconnect).toHaveBeenCalledTimes(1);
    });

    it('disconnects the admin client when the broker is unreachable', async () => {
        const { connection, admin } = createConnection();
        admin.connect.mockRejectedValue(new Error('Connection error'));

        await expect(new KafkaHealthIndicator(connection as any).check()).rejects.toThrow('Connection error');
        expect(admin.describeCluster).not.toHaveBeenCalled();
        expect(admin.disconnect).toHaveBeenCalledTimes(1);
    });
});
