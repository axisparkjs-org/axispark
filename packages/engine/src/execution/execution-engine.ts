import { Executable } from '@axisparkjs/common';
import { ExecutionContext } from './execution-context';
import { HandlerInvoker } from './handler-invoker';
import { Injectable } from '@axisparkjs/di';
import { ResultProcessor, ResultDefinition } from '../result';
import { ExecutionPlanner } from './execution-planner';
import { TimeoutProcessor, TimeoutDefinition, ExecutionTimeoutError } from '../timeout';
import { CacheProcessor } from '../cache';

/**
 * A class representing the execution engine for handling asynchronous execution flows.
 */
@Injectable()
export class ExecutionEngine implements Executable {
    constructor(
        private readonly planGenerator: ExecutionPlanner,
        private readonly handlerInvoker: HandlerInvoker,
        private readonly timeoutProcessor: TimeoutProcessor,
        private readonly resultProcessor: ResultProcessor,
        private readonly cacheProcessor: CacheProcessor
    ) {}

    /**
     * Executes the provided execution context by generating an execution plan, invoking handlers, processing timeouts, and handling results. It manages the flow of execution, including before, context, catch, and after steps, while also handling errors and timeouts.
     * When the plan has a cache definition, the before steps run on every request, and the handler is only invoked when its result is not cached.
     * The after steps and the result processor run as usual, so a cached result produces the same response as a fresh one.
     *
     * Every execution has its own `AbortSignal`, set in `context.signal`. It is aborted with an `ExecutionTimeoutError` before the timeout resolver runs, and with the reason of the signal given by the transport in `context.signal`, if any, when that signal is aborted. When the client stops waiting and the handler fails because of the abort, the catch steps are skipped, so the error is not handled as a failure of the handler, and the result processor receives `undefined` so the transport can end the request. The listener added to the signal of the transport is removed when the execution ends.
     * @param context The execution context to be processed.
     * @returns A promise that resolves when the execution is complete.
     */
    public async execute(context: ExecutionContext): Promise<void> {
        const controller = new AbortController();
        const transportSignal = context.signal as AbortSignal | undefined;
        const onTransportAbort = () => controller.abort(transportSignal?.reason);
        if (transportSignal?.aborted) controller.abort(transportSignal.reason);
        else transportSignal?.addEventListener('abort', onTransportAbort, { once: true });
        context.signal = controller.signal;

        try {
            await this.run(context, controller);
        } finally {
            transportSignal?.removeEventListener('abort', onTransportAbort);
        }
    }

    private async run(context: ExecutionContext, controller: AbortController): Promise<void> {
        const plan = await this.planGenerator.plan(context);
        let result: unknown | ResultDefinition;
        try {
            const execution = async () => {
                for (const step of plan.before) await this.handlerInvoker.invoke(step, context);
                const invoke = async () => await this.handlerInvoker.invoke(plan.context, context);
                return plan.cache ? await this.cacheProcessor.process(plan.cache, context, invoke) : await invoke();
            };

            if (plan.timeout) {
                const time = (plan.timeout as TimeoutDefinition).time;
                let timedOut = false;
                let timeoutId: ReturnType<typeof setTimeout> | undefined;
                const timeout = new Promise<void>((resolve, reject) => {
                    // The timer is cleared when the execution ends first, so it only runs while the handler is still running.
                    timeoutId = setTimeout(async () => {
                        timedOut = true;
                        controller.abort(new ExecutionTimeoutError(time, context.transport));
                        try {
                            await this.timeoutProcessor.process(plan.timeout as TimeoutDefinition, context);
                            resolve();
                        } catch (error) {
                            reject(error);
                        }
                    }, time);
                });

                // Once the timeout fires, the outcome of the handler is discarded: the execution follows the timeout, also when the handler rejects because of the abort before the timeout resolver ends.
                const guarded = execution().then(
                    (value) => (timedOut ? timeout : value),
                    (error) => {
                        if (timedOut) return timeout;
                        throw error;
                    }
                );

                try {
                    result = await Promise.race([guarded, timeout]);
                } finally {
                    clearTimeout(timeoutId);
                }
            } else {
                result = await execution();
            }
        } catch (error) {
            context.error = error as Error;
            // When the client stopped waiting and the handler failed because of the abort, the error filters are skipped: the error is not a failure of the handler and nobody will read the response.
            if (!this.isAbandoned(error, controller.signal)) {
                for (const step of plan.catch) {
                    const accepts = step.acceptedErrors.some((accepted) => error instanceof accepted);
                    if (!accepts) continue;

                    result = await this.handlerInvoker.invoke(step, context);
                    if (result !== undefined) break;
                }
            }
        } finally {
            for (const step of plan.after) await this.handlerInvoker.invoke(step, context);
        }

        // The result is processed also for abandoned executions, so the transport can end the request.
        await this.resultProcessor.process(result, context);
    }

    // The client stopped waiting (not a timeout) and the error was caused by the abort, so there is nobody to answer.
    private isAbandoned(error: unknown, signal: AbortSignal): boolean {
        if (!signal.aborted || signal.reason instanceof ExecutionTimeoutError) return false;
        return error === signal.reason || (error instanceof Error && error.name === 'AbortError');
    }
}
