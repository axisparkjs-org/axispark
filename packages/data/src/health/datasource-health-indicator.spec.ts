import { HealthStatus } from '@axisparkjs/core';
import { DataSourceHealthIndicator } from './datasource-health-indicator';

describe('DataSourceHealthIndicator', () => {
    const createDataSource = (type: string, isInitialized = true) => {
        const command = jest.fn().mockResolvedValue({ ok: 1 });
        return {
            dataSource: {
                options: { type },
                isInitialized,
                query: jest.fn().mockResolvedValue([{ 1: 1 }]),
                manager: { mongoQueryRunner: { databaseConnection: { db: () => ({ command }) } } }
            },
            command
        };
    };

    it('runs SELECT 1 on SQL data sources', async () => {
        const { dataSource } = createDataSource('postgres');

        await expect(new DataSourceHealthIndicator(dataSource as any).check()).resolves.toEqual({
            status: HealthStatus.Healthy,
            details: { type: 'postgres' }
        });
        expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('runs SELECT 1 FROM DUAL on Oracle data sources', async () => {
        const { dataSource } = createDataSource('oracle');

        await new DataSourceHealthIndicator(dataSource as any).check();

        expect(dataSource.query).toHaveBeenCalledWith('SELECT 1 FROM DUAL');
    });

    it('pings MongoDB data sources', async () => {
        const { dataSource, command } = createDataSource('mongodb');

        await expect(new DataSourceHealthIndicator(dataSource as any).check()).resolves.toEqual({
            status: HealthStatus.Healthy,
            details: { type: 'mongodb' }
        });
        expect(command).toHaveBeenCalledWith({ ping: 1 });
        expect(dataSource.query).not.toHaveBeenCalled();
    });

    it('reports uninitialized data sources as unhealthy', async () => {
        const { dataSource } = createDataSource('mysql', false);

        await expect(new DataSourceHealthIndicator(dataSource as any).check()).resolves.toEqual({
            status: HealthStatus.Unhealthy,
            details: { type: 'mysql', error: 'Data source is not initialized' }
        });
        expect(dataSource.query).not.toHaveBeenCalled();
    });

    it('propagates query failures', async () => {
        const { dataSource } = createDataSource('postgres');
        dataSource.query.mockRejectedValue(new Error('Connection terminated'));

        await expect(new DataSourceHealthIndicator(dataSource as any).check()).rejects.toThrow('Connection terminated');
    });
});
