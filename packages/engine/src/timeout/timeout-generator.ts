import { Metadata, MetadataKeys, Generator } from '@axisparkjs/common';
import { ExecutionContext, ExecutionTransport } from '../execution';
import { TimeoutMetadata } from '../metadata';
import { TimeoutDefinition } from './timeout-definition';
import { Injectable } from '@axisparkjs/di';

/**
 * A generator for creating timeout definitions based on metadata.
 * It retrieves timeout metadata from the execution context and generates a corresponding `TimeoutDefinition`.
 * If no specific timeout is defined, it falls back to a default timeout value or a registered timeout for the transport.
 */
@Injectable()
export class TimeoutGenerator implements Generator<TimeoutDefinition | undefined> {
    private static readonly defaultTimeout = 10000;
    private static readonly timeouts = new Map<ExecutionTransport, number>();

    public static registerTimeout(transport: ExecutionTransport, time?: number): void {
        this.timeouts.set(transport, time ?? this.defaultTimeout);
    }

    /**
     * Generates a timeout definition based on the provided execution context.
     * @param context The execution context containing relevant information for timeout generation.
     * The method metadata takes precedence over the class metadata, and both take precedence over the timeout registered for the transport.
     * A metadata disabled by `@NoTimeout()`, or with a negative time, disables the timeout.
     * @returns A generated timeout definition or undefined if no timeout is defined or the timeout is disabled.
     */
    public generate(context: ExecutionContext): TimeoutDefinition | undefined {
        const classMetadata = Metadata.get<TimeoutMetadata>(MetadataKeys.TIMEOUT, context.target);
        const methodMetadata = Metadata.get<TimeoutMetadata>(MetadataKeys.TIMEOUT, context.target, context.propertyKey);
        const metadata = [methodMetadata, classMetadata].find((item) => item !== undefined && (item.disabled || item.time !== undefined));

        if (metadata) {
            return TimeoutGenerator.isDisabled(metadata) ? undefined : new TimeoutDefinition(metadata.time as number);
        }

        const time = TimeoutGenerator.timeouts.get(context.transport);
        return time !== undefined ? new TimeoutDefinition(time) : undefined;
    }

    private static isDisabled(metadata: TimeoutMetadata): boolean {
        return metadata.disabled === true || (metadata.time as number) < 0;
    }
}
