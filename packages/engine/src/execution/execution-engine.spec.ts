import { ResultProcessor } from '../result';
import { TimeoutDefinition, TimeoutProcessor } from '../timeout';
import { ExecutionContext } from './execution-context';
import { ExecutionEngine } from './execution-engine';
import { HandlerInvoker } from './handler-invoker';
import { ExecutionPlanner } from './execution-planner';

describe('ExecutionEngine', () => {
    let engine: ExecutionEngine;

    let planGenerator: jest.Mocked<ExecutionPlanner>;
    let handlerInvoker: jest.Mocked<HandlerInvoker>;
    let timeoutProcessor: jest.Mocked<TimeoutProcessor>;
    let resultProcessor: jest.Mocked<ResultProcessor>;

    let context: ExecutionContext;

    beforeEach(() => {
        jest.useRealTimers();

        planGenerator = {
            plan: jest.fn()
        } as unknown as jest.Mocked<ExecutionPlanner>;

        handlerInvoker = {
            invoke: jest.fn()
        } as unknown as jest.Mocked<HandlerInvoker>;

        timeoutProcessor = {
            process: jest.fn()
        } as unknown as jest.Mocked<TimeoutProcessor>;

        resultProcessor = {
            process: jest.fn()
        } as unknown as jest.Mocked<ResultProcessor>;

        engine = new ExecutionEngine(planGenerator, handlerInvoker, timeoutProcessor, resultProcessor);

        context = {
            target: class Controller {},
            propertyKey: 'execute'
        } as ExecutionContext;
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('execute', () => {
        it('should generate the execution plan', async () => {
            const plan = {
                before: [],
                context: {},
                catch: [],
                after: []
            };

            planGenerator.plan.mockResolvedValue(plan as any);
            handlerInvoker.invoke.mockResolvedValue('result');

            await engine.execute(context);

            expect(planGenerator.plan).toHaveBeenCalledTimes(1);
            expect(planGenerator.plan).toHaveBeenCalledWith(context);
        });

        it('should invoke before steps in order', async () => {
            const before1 = {};
            const before2 = {};
            const executionContext = {};

            const plan = {
                before: [before1, before2],
                context: executionContext,
                catch: [],
                after: []
            };

            planGenerator.plan.mockResolvedValue(plan as any);

            handlerInvoker.invoke.mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined).mockResolvedValueOnce('result');

            await engine.execute(context);

            expect(handlerInvoker.invoke).toHaveBeenNthCalledWith(1, before1, context);

            expect(handlerInvoker.invoke).toHaveBeenNthCalledWith(2, before2, context);

            expect(handlerInvoker.invoke).toHaveBeenNthCalledWith(3, executionContext, context);
        });

        it('should invoke the main execution context after before steps', async () => {
            const before = {};
            const executionContext = {};

            const plan = {
                before: [before],
                context: executionContext,
                catch: [],
                after: []
            };

            planGenerator.plan.mockResolvedValue(plan as any);

            handlerInvoker.invoke.mockResolvedValueOnce(undefined).mockResolvedValueOnce('result');

            await engine.execute(context);

            expect(handlerInvoker.invoke).toHaveBeenCalledTimes(2);

            expect(handlerInvoker.invoke).toHaveBeenNthCalledWith(2, executionContext, context);
        });

        it('should process the result returned by the main handler', async () => {
            const result = {
                value: 'test'
            };

            const plan = {
                before: [],
                context: {},
                catch: [],
                after: []
            };

            planGenerator.plan.mockResolvedValue(plan as any);
            handlerInvoker.invoke.mockResolvedValue(result);

            await engine.execute(context);

            expect(resultProcessor.process).toHaveBeenCalledTimes(1);
            expect(resultProcessor.process).toHaveBeenCalledWith(result, context);
        });

        it('should process undefined when the main handler returns undefined', async () => {
            const plan = {
                before: [],
                context: {},
                catch: [],
                after: []
            };

            planGenerator.plan.mockResolvedValue(plan as any);
            handlerInvoker.invoke.mockResolvedValue(undefined);

            await engine.execute(context);

            expect(resultProcessor.process).toHaveBeenCalledWith(undefined, context);
        });

        it('should execute after steps after successful execution', async () => {
            const after1 = {};
            const after2 = {};

            const plan = {
                before: [],
                context: {},
                catch: [],
                after: [after1, after2]
            };

            planGenerator.plan.mockResolvedValue(plan as any);

            handlerInvoker.invoke.mockResolvedValueOnce('result').mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined);

            await engine.execute(context);

            expect(handlerInvoker.invoke).toHaveBeenNthCalledWith(2, after1, context);

            expect(handlerInvoker.invoke).toHaveBeenNthCalledWith(3, after2, context);

            expect(resultProcessor.process).toHaveBeenCalledWith('result', context);
        });

        it('should set context.error when a before step throws', async () => {
            const error = new Error('Before failed');

            const before = {};

            const plan = {
                before: [before],
                context: {},
                catch: [],
                after: []
            };

            planGenerator.plan.mockResolvedValue(plan as any);

            handlerInvoker.invoke.mockRejectedValue(error);

            await engine.execute(context);

            expect(context.error).toBe(error);
            expect(resultProcessor.process).toHaveBeenCalledWith(undefined, context);
        });

        it('should set context.error when the main handler throws', async () => {
            const error = new Error('Execution failed');

            const plan = {
                before: [],
                context: {},
                catch: [],
                after: []
            };

            planGenerator.plan.mockResolvedValue(plan as any);
            handlerInvoker.invoke.mockRejectedValue(error);

            await expect(engine.execute(context)).resolves.toBeUndefined();

            expect(context.error).toBe(error);
            expect(resultProcessor.process).toHaveBeenCalledWith(undefined, context);
        });

        it('should invoke a catch step when it accepts the error', async () => {
            const error = new TypeError('Execution failed');

            const catchStep = {
                acceptedErrors: [TypeError]
            };

            const catchResult = 'handled';

            const plan = {
                before: [],
                context: {},
                catch: [catchStep],
                after: []
            };

            planGenerator.plan.mockResolvedValue(plan as any);

            handlerInvoker.invoke.mockRejectedValueOnce(error).mockResolvedValueOnce(catchResult);

            await engine.execute(context);

            expect(context.error).toBe(error);

            expect(handlerInvoker.invoke).toHaveBeenNthCalledWith(2, catchStep, context);

            expect(resultProcessor.process).toHaveBeenCalledWith(catchResult, context);
        });

        it('should not invoke a catch step when it does not accept the error', async () => {
            const error = new TypeError('Execution failed');

            const catchStep = {
                acceptedErrors: [RangeError]
            };

            const plan = {
                before: [],
                context: {},
                catch: [catchStep],
                after: []
            };

            planGenerator.plan.mockResolvedValue(plan as any);
            handlerInvoker.invoke.mockRejectedValue(error);

            await engine.execute(context);

            expect(handlerInvoker.invoke).toHaveBeenCalledTimes(1);

            expect(resultProcessor.process).toHaveBeenCalledWith(undefined, context);
        });

        it('should try multiple catch steps until one accepts the error', async () => {
            const error = new TypeError('Execution failed');

            const firstCatch = {
                acceptedErrors: [RangeError]
            };

            const secondCatch = {
                acceptedErrors: [TypeError]
            };

            const handledResult = 'handled';

            const plan = {
                before: [],
                context: {},
                catch: [firstCatch, secondCatch],
                after: []
            };

            planGenerator.plan.mockResolvedValue(plan as any);

            handlerInvoker.invoke.mockRejectedValueOnce(error).mockResolvedValueOnce(handledResult);

            await engine.execute(context);

            expect(handlerInvoker.invoke).toHaveBeenCalledTimes(2);

            expect(handlerInvoker.invoke).toHaveBeenNthCalledWith(2, secondCatch, context);

            expect(resultProcessor.process).toHaveBeenCalledWith(handledResult, context);
        });

        it('should continue checking catch steps when an accepted catch returns undefined', async () => {
            const error = new TypeError('Execution failed');

            const firstCatch = {
                acceptedErrors: [TypeError]
            };

            const secondCatch = {
                acceptedErrors: [TypeError]
            };

            const result = 'handled';

            const plan = {
                before: [],
                context: {},
                catch: [firstCatch, secondCatch],
                after: []
            };

            planGenerator.plan.mockResolvedValue(plan as any);

            handlerInvoker.invoke.mockRejectedValueOnce(error).mockResolvedValueOnce(undefined).mockResolvedValueOnce(result);

            await engine.execute(context);

            expect(handlerInvoker.invoke).toHaveBeenNthCalledWith(2, firstCatch, context);

            expect(handlerInvoker.invoke).toHaveBeenNthCalledWith(3, secondCatch, context);

            expect(resultProcessor.process).toHaveBeenCalledWith(result, context);
        });

        it('should stop checking catch steps after a catch returns a result', async () => {
            const error = new TypeError('Execution failed');

            const firstCatch = {
                acceptedErrors: [TypeError]
            };

            const secondCatch = {
                acceptedErrors: [TypeError],
                doSomething: true
            };

            const result = 'handled';

            const plan = {
                before: [],
                context: {},
                catch: [firstCatch, secondCatch],
                after: []
            };

            planGenerator.plan.mockResolvedValue(plan as any);

            handlerInvoker.invoke.mockRejectedValueOnce(error).mockResolvedValueOnce(result);

            await engine.execute(context);

            expect(handlerInvoker.invoke).toHaveBeenCalledTimes(2);

            expect(handlerInvoker.invoke).not.toHaveBeenCalledWith(secondCatch, context);

            expect(resultProcessor.process).toHaveBeenCalledWith(result, context);
        });

        it('should execute after steps after an error', async () => {
            const error = new Error('Execution failed');

            const after = {};

            const plan = {
                before: [],
                context: {},
                catch: [],
                after: [after]
            };

            planGenerator.plan.mockResolvedValue(plan as any);

            handlerInvoker.invoke.mockRejectedValueOnce(error).mockResolvedValueOnce(undefined);

            await engine.execute(context);

            expect(context.error).toBe(error);

            expect(handlerInvoker.invoke).toHaveBeenNthCalledWith(2, after, context);
        });

        it('should execute after steps when an error is handled by catch', async () => {
            const error = new TypeError('Execution failed');

            const catchStep = {
                acceptedErrors: [TypeError]
            };

            const after = {};

            const plan = {
                before: [],
                context: {},
                catch: [catchStep],
                after: [after]
            };

            planGenerator.plan.mockResolvedValue(plan as any);

            handlerInvoker.invoke.mockRejectedValueOnce(error).mockResolvedValueOnce('handled').mockResolvedValueOnce(undefined);

            await engine.execute(context);

            expect(handlerInvoker.invoke).toHaveBeenNthCalledWith(2, catchStep, context);

            expect(handlerInvoker.invoke).toHaveBeenNthCalledWith(3, after, context);

            expect(resultProcessor.process).toHaveBeenCalledWith('handled', context);
        });
    });

    describe('timeout', () => {
        it('should not invoke the timeout processor when there is no timeout', async () => {
            const plan = {
                before: [],
                context: {},
                catch: [],
                after: [],
                timeout: undefined
            };

            planGenerator.plan.mockResolvedValue(plan as any);
            handlerInvoker.invoke.mockResolvedValue('result');

            await engine.execute(context);

            expect(timeoutProcessor.process).not.toHaveBeenCalled();
            expect(resultProcessor.process).toHaveBeenCalledWith('result', context);
        });

        it('should not invoke the timeout processor when execution finishes first', async () => {
            jest.useFakeTimers();

            const timeout = new TimeoutDefinition(1000);

            const plan = {
                before: [],
                context: {},
                catch: [],
                after: [],
                timeout
            };

            planGenerator.plan.mockResolvedValue(plan as any);
            handlerInvoker.invoke.mockResolvedValue('result');

            await engine.execute(context);

            expect(timeoutProcessor.process).not.toHaveBeenCalled();
            expect(resultProcessor.process).toHaveBeenCalledWith('result', context);
            expect(jest.getTimerCount()).toBe(0);
        });

        it('should invoke the timeout processor when execution does not finish before timeout', async () => {
            jest.useFakeTimers();

            const timeout = new TimeoutDefinition(1000);

            const plan = {
                before: [],
                context: {},
                catch: [],
                after: [],
                timeout
            };

            planGenerator.plan.mockResolvedValue(plan as any);

            handlerInvoker.invoke.mockImplementation(
                () =>
                    new Promise(() => {
                        // intentionally pending
                    })
            );

            timeoutProcessor.process.mockResolvedValue(undefined);

            const execution = engine.execute(context);

            await Promise.resolve();

            expect(timeoutProcessor.process).not.toHaveBeenCalled();

            jest.advanceTimersByTime(999);
            await Promise.resolve();

            expect(timeoutProcessor.process).not.toHaveBeenCalled();

            jest.advanceTimersByTime(1);
            await execution;

            expect(timeoutProcessor.process).toHaveBeenCalledTimes(1);
            expect(timeoutProcessor.process).toHaveBeenCalledWith(timeout, context);

            expect(resultProcessor.process).toHaveBeenCalledWith(undefined, context);
        });

        it('should wait exactly the configured timeout before processing the timeout', async () => {
            jest.useFakeTimers();

            const timeout = new TimeoutDefinition(5000);

            const plan = {
                before: [],
                context: {},
                catch: [],
                after: [],
                timeout
            };

            planGenerator.plan.mockResolvedValue(plan as any);

            handlerInvoker.invoke.mockImplementation(
                () =>
                    new Promise(() => {
                        // intentionally pending
                    })
            );

            timeoutProcessor.process.mockResolvedValue(undefined);

            const execution = engine.execute(context);

            await Promise.resolve();

            jest.advanceTimersByTime(4999);
            await Promise.resolve();

            expect(timeoutProcessor.process).not.toHaveBeenCalled();

            jest.advanceTimersByTime(1);
            await Promise.resolve();

            expect(timeoutProcessor.process).toHaveBeenCalledWith(timeout, context);

            void execution;
        });

        it('should use the execution result when execution finishes before timeout', async () => {
            jest.useFakeTimers();

            const timeout = new TimeoutDefinition(1000);
            const result = 'execution-result';

            const plan = {
                before: [],
                context: {},
                catch: [],
                after: [],
                timeout
            };

            planGenerator.plan.mockResolvedValue(plan as any);
            handlerInvoker.invoke.mockResolvedValue(result);

            await engine.execute(context);

            expect(resultProcessor.process).toHaveBeenCalledWith(result, context);

            expect(timeoutProcessor.process).not.toHaveBeenCalled();
            expect(jest.getTimerCount()).toBe(0);
        });

        it('should process undefined when the timeout wins the race', async () => {
            jest.useFakeTimers();

            const timeout = new TimeoutDefinition(1000);

            const plan = {
                before: [],
                context: {},
                catch: [],
                after: [],
                timeout
            };

            planGenerator.plan.mockResolvedValue(plan as any);

            handlerInvoker.invoke.mockImplementation(
                () =>
                    new Promise(() => {
                        // never resolves
                    })
            );

            timeoutProcessor.process.mockResolvedValue(undefined);

            const execution = engine.execute(context);

            await Promise.resolve();

            jest.advanceTimersByTime(1000);

            await execution;

            expect(timeoutProcessor.process).toHaveBeenCalledWith(timeout, context);

            expect(resultProcessor.process).toHaveBeenCalledWith(undefined, context);
        });

        it('should execute after steps when the timeout wins', async () => {
            jest.useFakeTimers();

            const timeout = new TimeoutDefinition(1000);
            const after = {};

            const plan = {
                before: [],
                context: {},
                catch: [],
                after: [after],
                timeout
            };

            planGenerator.plan.mockResolvedValue(plan as any);

            handlerInvoker.invoke
                .mockImplementationOnce(
                    () =>
                        new Promise(() => {
                            // never resolves
                        })
                )
                .mockResolvedValueOnce(undefined);

            timeoutProcessor.process.mockResolvedValue(undefined);

            const execution = engine.execute(context);

            await Promise.resolve();

            jest.advanceTimersByTime(1000);

            await execution;

            expect(timeoutProcessor.process).toHaveBeenCalledWith(timeout, context);

            expect(handlerInvoker.invoke).toHaveBeenNthCalledWith(2, after, context);
        });

        it('should handle an error thrown by the timeout processor', async () => {
            jest.useFakeTimers();

            const timeout = new TimeoutDefinition(1000);
            const error = new Error('Timeout processing failed');

            const catchStep = {
                acceptedErrors: [Error]
            };

            const plan = {
                before: [],
                context: {},
                catch: [catchStep],
                after: [],
                timeout
            };

            planGenerator.plan.mockResolvedValue(plan as any);

            handlerInvoker.invoke
                .mockImplementationOnce(
                    () =>
                        new Promise(() => {
                            // never resolves
                        })
                )
                .mockResolvedValueOnce('handled');

            timeoutProcessor.process.mockRejectedValue(error);

            const execution = engine.execute(context);

            await Promise.resolve();

            jest.advanceTimersByTime(1000);

            await execution;

            expect(context.error).toBe(error);

            expect(timeoutProcessor.process).toHaveBeenCalledWith(timeout, context);

            expect(handlerInvoker.invoke).toHaveBeenNthCalledWith(2, catchStep, context);

            expect(resultProcessor.process).toHaveBeenCalledWith('handled', context);
        });
    });

    describe('errors', () => {
        it('should propagate an error from plan generation', async () => {
            const error = new Error('Plan generation failed');

            planGenerator.plan.mockRejectedValue(error);

            await expect(engine.execute(context)).rejects.toBe(error);

            expect(handlerInvoker.invoke).not.toHaveBeenCalled();
            expect(resultProcessor.process).not.toHaveBeenCalled();
        });

        it('should propagate an error from the result processor', async () => {
            const error = new Error('Result processing failed');

            const plan = {
                before: [],
                context: {},
                catch: [],
                after: []
            };

            planGenerator.plan.mockResolvedValue(plan as any);
            handlerInvoker.invoke.mockResolvedValue('result');
            resultProcessor.process.mockRejectedValue(error);

            await expect(engine.execute(context)).rejects.toBe(error);
        });

        it('should propagate an error thrown by an after step', async () => {
            const error = new Error('After step failed');

            const plan = {
                before: [],
                context: {},
                catch: [],
                after: [{}]
            };

            planGenerator.plan.mockResolvedValue(plan as any);

            handlerInvoker.invoke.mockResolvedValueOnce('result').mockRejectedValueOnce(error);

            await expect(engine.execute(context)).rejects.toBe(error);

            expect(resultProcessor.process).not.toHaveBeenCalled();
        });
    });
});
