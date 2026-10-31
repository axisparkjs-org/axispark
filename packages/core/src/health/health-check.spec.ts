import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { ClassRegistry } from '@axisparkjs/di';
import { HealthCheck } from './health-check';
import { HealthIndicator } from './health-indicator';
import { HealthStatus } from './health-status';
import { HealthCheckResult } from './health-check-result';

describe('HealthCheck', () => {
    @HealthCheck()
    class DefaultHealth extends HealthIndicator {
        async check(): Promise<HealthCheckResult> {
            return { status: HealthStatus.Healthy };
        }
    }

    @HealthCheck({ name: 'custom', timeout: 1000, critical: false })
    class CustomHealth extends HealthIndicator {
        async check(): Promise<HealthCheckResult> {
            return { status: HealthStatus.Healthy };
        }
    }

    afterAll(() => {
        ClassRegistry.remove(DefaultHealth);
        ClassRegistry.remove(CustomHealth);
    });

    it('should register the class as injectable', () => {
        expect(ClassRegistry.getWithMetadata(MetadataKeys.INJECTABLE)).toEqual(expect.arrayContaining([DefaultHealth, CustomHealth]));
        expect(ClassRegistry.getWithMetadata(MetadataKeys.HEALTH_CHECK)).toEqual(expect.arrayContaining([DefaultHealth, CustomHealth]));
    });

    it('should define the default metadata', () => {
        expect(Metadata.get(MetadataKeys.HEALTH_CHECK, DefaultHealth)).toEqual({
            target: DefaultHealth,
            name: 'DefaultHealth',
            timeout: 5000,
            critical: true
        });
    });

    it('should define the metadata from the options', () => {
        expect(Metadata.get(MetadataKeys.HEALTH_CHECK, CustomHealth)).toEqual({
            target: CustomHealth,
            name: 'custom',
            timeout: 1000,
            critical: false
        });
    });
});
