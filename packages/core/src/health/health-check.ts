import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { Constructable } from '@axisparkjs/di';
import { DEFAULT_HEALTH_CHECK_TIMEOUT, HealthCheckOptions } from './health-check-options';
import { HealthCheckMetadata } from './health-check-metadata';

/**
 * A decorator for defining custom health checks. The decorated class must extend `HealthIndicator`. It is discovered automatically, resolved through the dependency injection container and run by the `HealthEngine`.
 * @param options The options of the health check.
 * @returns A class decorator.
 */
export function HealthCheck(options?: HealthCheckOptions): ClassDecorator {
    return (target) => {
        const metadata: HealthCheckMetadata = {
            target: Metadata.normalizeTarget(target),
            name: options?.name ?? target.name,
            timeout: options?.timeout ?? DEFAULT_HEALTH_CHECK_TIMEOUT,
            critical: options?.critical ?? true
        };
        Constructable(MetadataKeys.INJECTABLE)(target);
        Metadata.define(MetadataKeys.HEALTH_CHECK, metadata, target);
    };
}
