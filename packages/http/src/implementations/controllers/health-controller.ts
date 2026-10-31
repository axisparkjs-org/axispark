import { Controller, Get, HttpCode } from '../../decorators';
import { HealthEngine, HealthStatus } from '@axisparkjs/core';
import { ServiceUnavailableError } from '../errors';
import { HttpResponse } from '../../types';
import { Response } from '../parameters';
import { HandledResult } from '@axisparkjs/engine';

/**
 * A controller for handling health check endpoints.
 */
@Controller('/health')
export class HealthController {
    constructor(private readonly healthEngine: HealthEngine) {}

    /**
     * Gets the health status of the application.
     * @param response The HTTP response object.
     * @returns A promise resolving to the handled result.
     */
    @Get()
    public async getHealth(@Response() response: HttpResponse) {
        const checks = await this.healthEngine.checkAll();
        const appHealth = checks[0];
        const data = {
            status: appHealth.status,
            timestamp: new Date().toISOString(),
            checks
        };

        response.status(appHealth.status === HealthStatus.Healthy ? 200 : 503).json(data);

        return new HandledResult();
    }

    /**
     * Gets the liveness status of the application.
     * @returns A promise resolving to the liveness status.
     */
    @Get('/liveness')
    @HttpCode(200)
    public async getLiveness() {
        const appHealth = await this.healthEngine.checkApp();
        return { status: appHealth.status, timestamp: new Date().toISOString() };
    }

    /**
     * Gets the readiness status of the application.
     * @returns A promise resolving to the readiness status.
     */
    @Get('/readiness')
    @HttpCode(200)
    public async getReadiness() {
        const checks = await this.healthEngine.checkAll();
        if (checks[0].status === HealthStatus.Healthy) return { status: HealthStatus.Healthy, timestamp: new Date().toISOString() };

        const notHealthy = checks.filter((check) => check.status !== HealthStatus.Healthy && check.details?.critical !== false);
        throw new ServiceUnavailableError(`Some components are not healthy: ${notHealthy.map((check) => check.component).join(', ')}`);
    }
}
