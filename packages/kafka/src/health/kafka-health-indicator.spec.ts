import { HealthStatus } from '@axisparkjs/core';
import { KafkaHealthIndicator } from './kafka-health-indicator';

describe('KafkaHealthIndicator', () => {
    const createConnection = () => {
        const admin = {
            connect: jest.fn().mockResolvedValue(undefined),
            clusterId: jest.fn().mockResolvedValue('cluster'),
            disconnect: jest.fn().mockResolvedValue(undefined)
        };
        return { connection: { admin: jest.fn().mockReturnValue(admin) }, admin };
    };

    it('requests the cluster ID with an admin client without retries', async () => {
        const { connection, admin } = createConnection();

        await expect(new KafkaHealthIndicator(connection as any).check()).resolves.toEqual({
            status: HealthStatus.Healthy,
            details: { clusterId: 'cluster' }
        });
        expect(connection.admin).toHaveBeenCalledWith({ kafkaJS: { retry: { retries: 0 } } });
        expect(admin.clusterId).toHaveBeenCalledWith({ timeout: 4000 });
        expect(admin.connect).toHaveBeenCalledTimes(1);
        expect(admin.disconnect).toHaveBeenCalledTimes(1);
    });

    it('disconnects the admin client when the broker is unreachable', async () => {
        const { connection, admin } = createConnection();
        admin.connect.mockRejectedValue(new Error('Connection error'));

        await expect(new KafkaHealthIndicator(connection as any).check()).rejects.toThrow('Connection error');
        expect(admin.clusterId).not.toHaveBeenCalled();
        expect(admin.disconnect).toHaveBeenCalledTimes(1);
    });

    it('disconnects the admin client when the cluster ID is not available', async () => {
        const { connection, admin } = createConnection();
        admin.clusterId.mockRejectedValue(new Error('Cluster id is not available'));

        await expect(new KafkaHealthIndicator(connection as any).check()).rejects.toThrow('Cluster id is not available');
        expect(admin.disconnect).toHaveBeenCalledTimes(1);
    });
});
