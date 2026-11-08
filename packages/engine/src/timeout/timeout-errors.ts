/**
 * An error thrown by the engine when an execution exceeds its timeout and no timeout resolver is registered for its transport.
 * The error filters of the transport handle it like any other error, so a timeout never ends with an empty result.
 */
export class ExecutionTimeoutError extends Error {
    public constructor(
        public readonly time: number,
        public readonly transport: string
    ) {
        super(`Execution timed out after ${time}ms`);
        this.name = this.constructor.name;
    }
}
