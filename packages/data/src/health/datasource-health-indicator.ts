import { HealthCheckResult, HealthIndicator, HealthStatus } from '@axisparkjs/core';
import { DataSource, MongoEntityManager } from 'typeorm';

/**
 * A health indicator that checks a TypeORM data source by running a lightweight query (`SELECT 1` in SQL databases, `ping` in MongoDB).
 */
export class DataSourceHealthIndicator extends HealthIndicator {
    constructor(private readonly dataSource: DataSource) {
        super();
    }

    /**
     * Checks that the data source is initialized and that the database answers a lightweight query.
     * @returns A promise resolving to the result of the health check.
     */
    async check(): Promise<HealthCheckResult> {
        const type = this.dataSource.options.type;
        if (!this.dataSource.isInitialized) return { status: HealthStatus.Unhealthy, details: { type, error: 'Data source is not initialized' } };

        if (type === 'mongodb') await (this.dataSource.manager as MongoEntityManager).mongoQueryRunner.databaseConnection.db().command({ ping: 1 });
        else await this.dataSource.query(type === 'oracle' ? 'SELECT 1 FROM DUAL' : 'SELECT 1');

        return { status: HealthStatus.Healthy, details: { type } };
    }
}
