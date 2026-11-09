import { HealthEngine, HealthStatus } from '@axisparkjs/core';
import { TestTelemetry } from '../../test/otel';
import { HealthTelemetry } from './health-telemetry';

describe('HealthTelemetry', () => {
    let telemetry: TestTelemetry;
    let healthEngine: jest.Mocked<HealthEngine>;

    beforeEach(() => {
        telemetry = new TestTelemetry().register();
        healthEngine = {
            checkAll: jest.fn().mockResolvedValue([
                { component: 'Orders API', status: HealthStatus.Unhealthy },
                { component: 'HttpPlugin', status: HealthStatus.Healthy },
                { component: 'redis:MAIN', status: HealthStatus.Unhealthy },
                { component: 'SchedulePlugin', status: HealthStatus.Unknown }
            ])
        } as unknown as jest.Mocked<HealthEngine>;
    });

    afterEach(async () => {
        await telemetry.shutdown();
    });

    it('reports 1 for the healthy components and 0 for the others when the metrics are collected', async () => {
        new HealthTelemetry(telemetry.meter(), healthEngine);

        const points = await telemetry.dataPoints('axispark.health.status');

        expect(points.map((point) => [point.attributes['axispark.health.check'], point.value])).toEqual([
            ['Orders API', 0],
            ['HttpPlugin', 1],
            ['redis:MAIN', 0],
            ['SchedulePlugin', 0]
        ]);
        expect(healthEngine.checkAll).toHaveBeenCalledTimes(1);
    });

    it('stops running the health checks when it is disposed', async () => {
        new HealthTelemetry(telemetry.meter(), healthEngine).dispose();

        await telemetry.dataPoints('axispark.health.status');

        expect(healthEngine.checkAll).not.toHaveBeenCalled();
    });
});
