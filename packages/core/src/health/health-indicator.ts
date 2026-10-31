import { HealthCheckResult } from './health-check-result';

/**
 * An abstract class for defining custom health checks. Classes extending `HealthIndicator` and decorated with `@HealthCheck` are discovered automatically and run by the `HealthEngine` every time the health of the application is checked.
 * Plugins can also register their own indicators with `HealthEngine.register()`.
 */
export abstract class HealthIndicator {
    /**
     * Checks the health of a dependency. If the method throws an error or exceeds its timeout, the check is reported as `Unhealthy`.
     * @returns A promise resolving to the result of the health check.
     */
    abstract check(): Promise<HealthCheckResult>;
}
