/**
 * An interface representing the options of a health check.
 * Properties:
 * - `name`: The component name of the check in the health response.
 * - `timeout`: The maximum time in milliseconds for the check.
 * - `critical`: Whether a failure of the check makes the whole application `Unhealthy`.
 * - `cacheTtl`: The time in milliseconds that the result of the check is reused.
 */
export interface HealthCheckOptions {
    /**
     * The component name of the check in the health response. Defaults to the class name of the indicator.
     */
    name?: string;

    /**
     * The maximum time in milliseconds for the check. If it is exceeded, the check is reported as `Unhealthy`. Defaults to 5000.
     */
    timeout?: number;

    /**
     * Whether a failure of the check makes the whole application `Unhealthy`. Defaults to `true`.
     */
    critical?: boolean;

    /**
     * The time in milliseconds that the result of the check is reused by the next health requests, so frequent probes do not run it every
     * time. Overrides the `healthChecks.cacheTtl` of the application. `0` runs the check on every request. Defaults to the one of the application.
     */
    cacheTtl?: number;
}

/**
 * The default timeout in milliseconds of a health check.
 */
export const DEFAULT_HEALTH_CHECK_TIMEOUT = 5000;
