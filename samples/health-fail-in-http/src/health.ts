import { HealthCheck, HealthCheckResult, HealthIndicator } from '@axisparkjs/core';

@HealthCheck({ name: 'payments-api', timeout: 100 })
export class PaymentsApiHealth extends HealthIndicator {
    async check(): Promise<HealthCheckResult> {
        return await new Promise(() => {
            // Never resolves to force the timeout of the health check
        });
    }
}
