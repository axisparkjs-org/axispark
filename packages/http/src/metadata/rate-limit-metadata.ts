import { ClassType } from '@axisparkjs/common';
import { RateLimitDecoratorOptions } from '../plugin/http-plugin-options';

/** Rate limit metadata declared on a controller or handler. */
export interface RateLimitMetadata {
    target: ClassType;
    propertyKey?: string | symbol;
    /** Whether this scope opts out of rate limiting. */
    disabled: boolean;
    /** Per-scope overrides. Omitted values use the configured defaults. */
    options?: RateLimitDecoratorOptions;
}
