import { HealthCheckResult, HealthIndicator, HealthStatus } from '@axisparkjs/core';
import { AmqpConnectionManager } from 'amqp-connection-manager';

/**
 * A health indicator that checks that a RabbitMQ connection is open.
 */
export class RabbitMQHealthIndicator extends HealthIndicator {
    constructor(private readonly connection: AmqpConnectionManager) {
        super();
    }

    /**
     * Checks that the connection is open and reports its number of channels.
     * @returns A promise resolving to the result of the health check.
     */
    async check(): Promise<HealthCheckResult> {
        const channels = this.connection.channelCount;
        if (!this.connection.isConnected()) return { status: HealthStatus.Unhealthy, details: { channels, error: 'Connection is not open' } };
        return { status: HealthStatus.Healthy, details: { channels } };
    }
}
