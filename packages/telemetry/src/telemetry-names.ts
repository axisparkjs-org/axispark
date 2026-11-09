/** The name and version of the instrumentation scope of the tracer and the meter. */
export const INSTRUMENTATION_SCOPE = '@axisparkjs/telemetry';

/** The names of the metrics recorded by the `TelemetryPlugin`. */
export const TelemetryMetrics = {
    HTTP_SERVER_REQUEST_DURATION: 'http.server.request.duration',
    EXECUTION_DURATION: 'axispark.execution.duration',
    RATE_LIMIT_REJECTIONS: 'axispark.rate_limit.rejections',
    JOB_DURATION: 'axispark.job.duration',
    JOB_EXECUTIONS: 'axispark.job.executions',
    STORE_OPERATION_DURATION: 'axispark.store.operation.duration',
    HEALTH_STATUS: 'axispark.health.status'
} as const;

/** The names of the attributes of the spans and metrics recorded by the `TelemetryPlugin`. */
export const TelemetryAttributes = {
    TRANSPORT: 'axispark.transport',
    HANDLER: 'axispark.handler',
    OUTCOME: 'outcome',
    JOB_NAME: 'axispark.job.name',
    JOB_TYPE: 'axispark.job.type',
    STORE_KIND: 'axispark.store.kind',
    STORE_OPERATION: 'axispark.store.operation',
    HEALTH_CHECK: 'axispark.health.check',
    WEBSOCKET_EVENT: 'axispark.websocket.event',
    MCP_CAPABILITY: 'axispark.mcp.capability',
    MCP_NAME: 'axispark.mcp.name',
    ERROR_TYPE: 'error.type',
    HTTP_REQUEST_METHOD: 'http.request.method',
    HTTP_ROUTE: 'http.route',
    HTTP_RESPONSE_STATUS_CODE: 'http.response.status_code',
    URL_PATH: 'url.path'
} as const;

/** Seconds elapsed since a `performance.now()` value. */
export function secondsSince(start: number): number {
    return (performance.now() - start) / 1000;
}

/** The value of the `error.type` attribute of an error: its name, or `_OTHER` when it has none. */
export function errorType(error: unknown): string {
    if (error instanceof Error) return error.constructor?.name && error.constructor.name !== 'Object' ? error.constructor.name : error.name;
    return '_OTHER';
}
