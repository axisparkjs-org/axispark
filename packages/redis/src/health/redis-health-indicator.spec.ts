import { HealthStatus } from '@axisparkjs/core';
import { RedisHealthIndicator } from './redis-health-indicator';

describe('RedisHealthIndicator', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('reports a client that answers the PING as healthy with its latency', async () => {
        jest.spyOn(Date, 'now').mockReturnValueOnce(1_000).mockReturnValueOnce(1_004);
        const connection = { isReady: true, ping: jest.fn().mockResolvedValue('PONG') };

        await expect(new RedisHealthIndicator(connection as any).check()).resolves.toEqual({
            status: HealthStatus.Healthy,
            details: { latencyMs: 4 }
        });
        expect(connection.ping).toHaveBeenCalledTimes(1);
    });

    it('reports a client that is not ready as unhealthy without sending the PING', async () => {
        const connection = { isReady: false, ping: jest.fn() };

        await expect(new RedisHealthIndicator(connection as any).check()).resolves.toEqual({
            status: HealthStatus.Unhealthy,
            details: { error: 'Client is not ready' }
        });
        expect(connection.ping).not.toHaveBeenCalled();
    });

    it('reports a failed PING as unhealthy with the error', async () => {
        const connection = { isReady: true, ping: jest.fn().mockRejectedValue(new Error('LOADING Redis is loading the dataset in memory')) };

        await expect(new RedisHealthIndicator(connection as any).check()).resolves.toEqual({
            status: HealthStatus.Unhealthy,
            details: { error: 'LOADING Redis is loading the dataset in memory' }
        });
    });

    it('reports errors that are not Error instances', async () => {
        const connection = { isReady: true, ping: jest.fn().mockRejectedValue('timeout') };

        await expect(new RedisHealthIndicator(connection as any).check()).resolves.toEqual({
            status: HealthStatus.Unhealthy,
            details: { error: 'timeout' }
        });
    });
});
