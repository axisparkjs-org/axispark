import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { RateLimitMetadata, RateLimitConfiguration } from '../metadata';

/** Applies rate limit overrides to a class or handler. */
export function RateLimit(options: RateLimitConfiguration = {}): MethodDecorator & ClassDecorator {
    return (target: object, propertyKey?: string | symbol) => {
        const metadata: RateLimitMetadata = {
            target: Metadata.normalizeTarget(target),
            propertyKey,
            disabled: false,
            options
        };

        if (propertyKey !== undefined) Metadata.define(MetadataKeys.RATE_LIMIT, metadata, target, propertyKey);
        else Metadata.define(MetadataKeys.RATE_LIMIT, metadata, target);
    };
}

/** Disables rate limiting for a class or handler. */
export function NoRateLimit(): MethodDecorator & ClassDecorator {
    return (target: object, propertyKey?: string | symbol) => {
        const metadata: RateLimitMetadata = {
            target: Metadata.normalizeTarget(target),
            propertyKey,
            disabled: true
        };

        if (propertyKey !== undefined) Metadata.define(MetadataKeys.RATE_LIMIT, metadata, target, propertyKey);
        else Metadata.define(MetadataKeys.RATE_LIMIT, metadata, target);
    };
}
