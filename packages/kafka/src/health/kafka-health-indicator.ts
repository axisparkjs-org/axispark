import { HealthCheckResult, HealthIndicator, HealthStatus } from '@axisparkjs/core';
import { Kafka } from 'kafkajs';

/**
 * A health indicator that checks the connection to the Kafka brokers with the admin client.
 */
export class KafkaHealthIndicator extends HealthIndicator {
    constructor(private readonly connection: Kafka) {
        super();
    }

    /**
     * Connects an admin client without retries and describes the cluster.
     * @returns A promise resolving to the result of the health check.
     */
    async check(): Promise<HealthCheckResult> {
        const admin = this.connection.admin({ retry: { retries: 0 } });
        try {
            await admin.connect();
            const { clusterId, brokers, controller } = await admin.describeCluster();
            return { status: HealthStatus.Healthy, details: { clusterId, brokers: brokers.length, controller } };
        } finally {
            await admin.disconnect();
        }
    }
}
