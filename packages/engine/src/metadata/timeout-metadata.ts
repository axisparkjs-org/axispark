import { MetadataFromClassOrMethod } from '@axisparkjs/common';

/** Timeout metadata declared on a class or method. */
export interface TimeoutMetadata extends MetadataFromClassOrMethod {
    /** The timeout duration in milliseconds. A negative time disables the timeout, for metadata defined by previous versions of `@NoTimeout()`. */
    time?: number;
    /** Whether the timeout is disabled, as defined by `@NoTimeout()`. */
    disabled?: boolean;
}
