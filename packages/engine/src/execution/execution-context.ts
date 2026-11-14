import { ScopedContainer } from '@axisparkjs/di';
import { ExecutionTransport } from './execution-transport';
import { ExecutionHandler } from './execution-handler';

/**
 * An interface representing the execution context for a request of any kind. It extends the `ExecutionHandler` interface and includes additional properties such as `error`, `transport`, `scopedContainer` and `signal`. The `error` property is optional and can hold an error object if an error occurred during execution. The `transport` property indicates the transport mechanism used for the execution, and the `scopedContainer` property provides access to a scoped dependency injection container for managing dependencies within the execution context.
 */
export interface ExecutionContext extends ExecutionHandler {
    error?: Error;
    transport: ExecutionTransport;
    scopedContainer: ScopedContainer;

    /**
     * Aborted when the execution times out (with an `ExecutionTimeoutError` as reason) or its client stops waiting (with the reason given by the transport, such as a `ClientDisconnectedError`). Pass it to `fetch`, database drivers or your own loops to stop the work of a handler that nobody will read. Handlers receive it with `@Signal()`.
     *
     * The transport can give its own signal in this property when it creates the context: the `ExecutionEngine` replaces it with a signal of the execution that is also aborted when the signal of the transport is aborted.
     */
    signal: AbortSignal;
}
