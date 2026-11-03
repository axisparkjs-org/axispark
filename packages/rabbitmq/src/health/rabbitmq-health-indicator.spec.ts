import { HealthStatus } from '@axisparkjs/core';
import { RabbitMQHealthIndicator } from './rabbitmq-health-indicator';

describe('RabbitMQHealthIndicator', () => {
    it('reports open connections as healthy', async () => {
        const connection = { isConnected: jest.fn().mockReturnValue(true), channelCount: 2 };

        await expect(new RabbitMQHealthIndicator(connection as any).check()).resolves.toEqual({
            status: HealthStatus.Healthy,
            details: { channels: 2 }
        });
    });

    it('reports closed connections as unhealthy', async () => {
        const connection = { isConnected: jest.fn().mockReturnValue(false), channelCount: 1 };

        await expect(new RabbitMQHealthIndicator(connection as any).check()).resolves.toEqual({
            status: HealthStatus.Unhealthy,
            details: { channels: 1, error: 'Connection is not open' }
        });
    });
});
