import { HealthCheckResult, HealthIndicator, HealthStatus } from '@axisparkjs/core';
import { Kafka } from '../client';

/**
 * The maximum time in milliseconds to wait for the cluster ID. It is lower than the default timeout of a health check,
 * so an unreachable broker is reported with the error of the client.
 */
const CLUSTER_ID_TIMEOUT = 4000;

/**
 * A health indicator that checks the connection to the Kafka brokers with the admin client.
 */
export class KafkaHealthIndicator extends HealthIndicator {
    constructor(private readonly connection: Kafka) {
        super();
    }

    /**
     * Connects an admin client without retries and requests the ID of the cluster.
     * @returns A promise resolving to the result of the health check.
     */
    async check(): Promise<HealthCheckResult> {
        const admin = this.connection.admin({ kafkaJS: { retry: { retries: 0 } } });
        try {
            await admin.connect();
            const clusterId = await admin.clusterId({ timeout: CLUSTER_ID_TIMEOUT });
            return { status: HealthStatus.Healthy, details: { clusterId } };
        } finally {
            await admin.disconnect();
        }
    }
}
