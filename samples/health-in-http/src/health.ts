import { HealthCheck, HealthCheckResult, HealthIndicator, HealthStatus } from '@axisparkjs/core';
import { Logger } from '@axisparkjs/logger';

@HealthCheck({ name: 'uptime' })
export class UptimeHealth extends HealthIndicator {
    constructor(private readonly logger: Logger) {
        super();
    }

    async check(): Promise<HealthCheckResult> {
        await this.logger.debug('Checking uptime');
        return { status: HealthStatus.Healthy, details: { uptime: process.uptime() } };
    }
}

@HealthCheck({ name: 'recommendations-api', critical: false })
export class RecommendationsApiHealth extends HealthIndicator {
    async check(): Promise<HealthCheckResult> {
        throw new Error('Recommendations API is not reachable');
    }
}
