import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { RateLimitDecoratorOptions } from '../plugin/http-plugin-options';
import { RateLimitMetadata } from '../metadata/rate-limit-metadata';

/** Apply rate limit overrides to a controller or handler. */
export function RateLimit(options: RateLimitDecoratorOptions = {}): MethodDecorator & ClassDecorator {
    return function (target: object, propertyKey?: string | symbol) {
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

/** Disable rate limiting for a controller or handler. */
export const NoRateLimit = (): MethodDecorator & ClassDecorator => {
    return function (target: object, propertyKey?: string | symbol) {
        const metadata: RateLimitMetadata = {
            target: Metadata.normalizeTarget(target),
            propertyKey,
            disabled: true
        };

        if (propertyKey !== undefined) Metadata.define(MetadataKeys.RATE_LIMIT, metadata, target, propertyKey);
        else Metadata.define(MetadataKeys.RATE_LIMIT, metadata, target);
    };
};
