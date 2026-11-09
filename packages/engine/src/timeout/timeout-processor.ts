import { Processable } from '@axisparkjs/common';
import { Injectable } from '@axisparkjs/di';
import { ExecutionContext, ExecutionTransport } from '../execution';
import { TimeoutResolver } from './timeout-resolver';
import { TimeoutDefinition } from './timeout-definition';
import { ExecutionTimeoutError } from './timeout-errors';

/**
 * A processor for handling timeout operations.
 * It resolves timeout definitions using registered resolvers based on the execution transport.
 */
@Injectable()
export class TimeoutProcessor implements Processable {
    private static readonly resolvers = new Map<ExecutionTransport, TimeoutResolver>();

    static registerTimeout(transport: ExecutionTransport, resolver: TimeoutResolver): void {
        this.resolvers.set(transport, resolver);
    }

    /**
     * Processes a timeout definition based on the provided execution context.
     * @param timeout The timeout definition to process.
     * @param context The execution context containing relevant information for timeout processing.
     * @returns A promise resolving when the timeout has been processed.
     * @throws {ExecutionTimeoutError} When no resolver is registered for the transport of the context.
     */
    async process(timeout: TimeoutDefinition, context: ExecutionContext): Promise<void> {
        const resolver = TimeoutProcessor.resolvers.get(context.transport);
        if (!resolver) {
            throw new ExecutionTimeoutError(timeout.time, context.transport);
        }

        await resolver.resolve(timeout);
    }
}
