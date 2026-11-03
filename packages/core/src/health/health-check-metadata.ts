import { MetadataFromClass } from '@axisparkjs/common';
import { HealthCheckOptions } from './health-check-options';

/**
 * An interface representing the metadata stored by the `@HealthCheck` decorator.
 */
export interface HealthCheckMetadata extends MetadataFromClass, Required<HealthCheckOptions> {}
