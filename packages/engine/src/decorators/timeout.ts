import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { TimeoutMetadata } from '../metadata';

function defineTimeout(metadata: TimeoutMetadata, target: any, propertyKey?: string | symbol): void {
    if (propertyKey !== undefined) {
        // Method decorator
        Metadata.define(MetadataKeys.TIMEOUT, metadata, target, propertyKey);
    } else {
        // Class decorator
        Metadata.define(MetadataKeys.TIMEOUT, metadata, target);
    }
}

/**
 * A decorator for defining a timeout for a method or class.
 * The timeout of a method takes precedence over the timeout of its class, and both take precedence over the default timeout of the transport.
 * @param time The timeout duration in milliseconds. It must be a number greater than 0.
 * @returns A timeout decorator.
 * @throws An error when the time is not a number greater than 0. Use `@NoTimeout()` to disable the timeout.
 */
export function Timeout(time: number): MethodDecorator & ClassDecorator {
    if (typeof time !== 'number' || Number.isNaN(time) || time <= 0) {
        throw new Error(
            `Invalid timeout '${time}': the time of @Timeout() must be a number of milliseconds greater than 0. Use @NoTimeout() to disable the timeout.`
        );
    }

    return function (target: any, propertyKey?: string | symbol) {
        const metadata: TimeoutMetadata = {
            target: Metadata.normalizeTarget(target),
            propertyKey,
            time
        };
        defineTimeout(metadata, target, propertyKey);
    };
}

/**
 * A decorator for disabling the timeout of a method or class.
 * On a method, it disables the timeout of its class and the default timeout of the transport.
 * On a class, it disables the timeout of all its handlers, unless a method has its own `@Timeout()`.
 * @returns A no timeout decorator.
 */
export function NoTimeout(): MethodDecorator & ClassDecorator {
    return function (target: any, propertyKey?: string | symbol) {
        const metadata: TimeoutMetadata = {
            target: Metadata.normalizeTarget(target),
            propertyKey,
            disabled: true
        };
        defineTimeout(metadata, target, propertyKey);
    };
}
