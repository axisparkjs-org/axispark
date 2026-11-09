import { HealthCheckResult, HealthIndicator, HealthStatus } from '@axisparkjs/core';
import { RedisClientType } from 'redis';

/**
 * A health indicator that checks that a Redis connection answers a `PING`.
 */
export class RedisHealthIndicator extends HealthIndicator {
    constructor(private readonly connection: RedisClientType) {
        super();
    }

    /**
     * Sends a `PING` and reports its latency. The `PING` is not sent when the client is not ready, because node-redis would queue it until the client reconnects.
     * @returns A promise resolving to the result of the health check.
     */
    async check(): Promise<HealthCheckResult> {
        if (!this.connection.isReady) return { status: HealthStatus.Unhealthy, details: { error: 'Client is not ready' } };

        const startedAt = Date.now();
        try {
            await this.connection.ping();
            return { status: HealthStatus.Healthy, details: { latencyMs: Date.now() - startedAt } };
        } catch (error) {
            return { status: HealthStatus.Unhealthy, details: { error: error instanceof Error ? error.message : String(error) } };
        }
    }
}
