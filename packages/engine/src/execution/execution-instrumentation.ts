import type { ExecutionContext } from './execution-context';

/** How an execution ended. `error` is the error thrown by a step or the handler, even when a filter handled it. */
export interface ExecutionOutcome {
    error?: Error;
}

/**
 * Observes one execution. Returned by `ExecutionInstrumentation.start()`.
 */
export interface ExecutionObserver {
    /**
     * Runs the rest of the execution. An instrumentation runs it inside its own context, so the work of the handler, such as the
     * database queries traced by OpenTelemetry, is a child of the span of the request. Without it, the execution runs as it is.
     */
    run?<T>(execution: () => Promise<T>): Promise<T>;
    /** Called once when the execution ends, after the result has been processed. */
    end(outcome: ExecutionOutcome): void;
}

/**
 * Observes the executions of every transport, such as `@axisparkjs/telemetry`, which creates a span and records the duration of each one.
 * Register it with `ExecutionEngine.registerInstrumentation()`. The framework packages never depend on a specific implementation.
 */
export interface ExecutionInstrumentation {
    /**
     * Called before the plan of an execution runs.
     * @param context The execution context.
     * @returns The observer of the execution, or a function called when the execution ends.
     */
    start(context: ExecutionContext): ExecutionObserver | ((outcome: ExecutionOutcome) => void);
}
