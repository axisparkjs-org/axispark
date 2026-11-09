import { ResultProcessor } from '../result';
import { TimeoutProcessor } from '../timeout';
import { ExecutionContext } from './execution-context';
import { ExecutionEngine } from './execution-engine';
import { ExecutionPlanner } from './execution-planner';
import { HandlerInvoker } from './handler-invoker';

describe('ExecutionEngine instrumentation', () => {
    let engine: ExecutionEngine;
    let planner: jest.Mocked<ExecutionPlanner>;
    let invoker: jest.Mocked<HandlerInvoker>;
    let resultProcessor: jest.Mocked<ResultProcessor>;
    let context: ExecutionContext;

    beforeEach(() => {
        planner = { plan: jest.fn().mockResolvedValue({ before: [], context: {}, catch: [], after: [] }) } as unknown as jest.Mocked<ExecutionPlanner>;
        invoker = { invoke: jest.fn().mockResolvedValue('result') } as unknown as jest.Mocked<HandlerInvoker>;
        resultProcessor = { process: jest.fn() } as unknown as jest.Mocked<ResultProcessor>;
        engine = new ExecutionEngine(planner, invoker, { process: jest.fn() } as unknown as TimeoutProcessor, resultProcessor);
        context = { target: class Controller {}, propertyKey: 'handle' } as ExecutionContext;
    });

    afterEach(() => {
        ExecutionEngine.registerInstrumentation();
    });

    it('runs the execution inside the observer and ends it after the result is processed', async () => {
        const calls: string[] = [];
        resultProcessor.process.mockImplementation(async () => {
            calls.push('result');
        });
        const observer = {
            run: jest.fn(async (execution: () => Promise<unknown>) => {
                calls.push('run');
                return await execution();
            }),
            end: jest.fn(() => calls.push('end'))
        };
        const start = jest.fn().mockReturnValue(observer);
        ExecutionEngine.registerInstrumentation({ start });

        await engine.execute(context);

        expect(start).toHaveBeenCalledWith(context);
        expect(calls).toEqual(['run', 'result', 'end']);
        expect(observer.end).toHaveBeenCalledWith({ error: undefined });
    });

    it('accepts an end function and reports the error handled by the filters', async () => {
        const end = jest.fn();
        ExecutionEngine.registerInstrumentation({ start: () => end });
        const error = new Error('handled');
        invoker.invoke.mockRejectedValue(error);

        await engine.execute(context);

        expect(end).toHaveBeenCalledWith({ error });
    });

    it('reports the errors that escape the execution and rethrows them', async () => {
        const end = jest.fn();
        ExecutionEngine.registerInstrumentation({ start: () => ({ end }) });
        const error = new Error('result failed');
        resultProcessor.process.mockRejectedValue(error);

        await expect(engine.execute(context)).rejects.toBe(error);

        expect(end).toHaveBeenCalledWith({ error });
    });
});
