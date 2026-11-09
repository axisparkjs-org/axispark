import { Executable } from '@axisparkjs/common';
import { ExecutionContext } from './execution-context';
import { HandlerInvoker } from './handler-invoker';
import { Injectable } from '@axisparkjs/di';
import { ResultProcessor, ResultDefinition } from '../result';
import { ExecutionPlanner } from './execution-planner';
import { TimeoutProcessor, TimeoutDefinition } from '../timeout';
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
     * @param context The execution context to be processed.
     * @returns A promise that resolves when the execution is complete.
     */
    public async execute(context: ExecutionContext): Promise<void> {
        const plan = await this.planGenerator.plan(context);
        let result: unknown | ResultDefinition;
        try {
            const execution = async () => {
                for (const step of plan.before) await this.handlerInvoker.invoke(step, context);
                const invoke = async () => await this.handlerInvoker.invoke(plan.context, context);
                return plan.cache ? await this.cacheProcessor.process(plan.cache, context, invoke) : await invoke();
            };

            if (plan.timeout) {
                let finished = false;
                let timeoutId: ReturnType<typeof setTimeout> | undefined;
                const timeout = async () => {
                    await new Promise<void>((resolve, reject) => {
                        timeoutId = setTimeout(
                            async () => {
                                if (finished) {
                                    resolve();
                                    return;
                                }

                                try {
                                    await this.timeoutProcessor.process(plan.timeout as TimeoutDefinition, context);
                                    resolve();
                                } catch (error) {
                                    reject(error);
                                }
                            },
                            (plan.timeout as TimeoutDefinition).time
                        );
                    });
                };

                try {
                    result = await Promise.race([execution(), timeout()]);
                } finally {
                    finished = true;
                    if (timeoutId !== undefined) clearTimeout(timeoutId);
                }
            } else {
                result = await execution();
            }
        } catch (error) {
            context.error = error as Error;
            for (const step of plan.catch) {
                const accepts = step.acceptedErrors.some((accepted) => error instanceof accepted);
                if (!accepts) continue;

                result = await this.handlerInvoker.invoke(step, context);
                if (result !== undefined) break;
            }
        } finally {
            for (const step of plan.after) await this.handlerInvoker.invoke(step, context);
        }

        await this.resultProcessor.process(result, context);
    }
}
