/**
 * An interface representing the options of a health check.
 * Properties:
 * - `name`: The component name of the check in the health response.
 * - `timeout`: The maximum time in milliseconds for the check.
 * - `critical`: Whether a failure of the check makes the whole application `Unhealthy`.
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
}

/**
 * The default timeout in milliseconds of a health check.
 */
export const DEFAULT_HEALTH_CHECK_TIMEOUT = 5000;
