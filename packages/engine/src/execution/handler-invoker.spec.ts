import { Injector } from '@axisparkjs/di';
import { ParameterDefinition, ParameterGenerator } from '../parameter';
import { PipeDefinition, PipeGenerator, PipeProcessor } from '../pipe';
import { ExecutionContext } from './execution-context';
import { ExecutionHandler } from './execution-handler';
import { HandlerInvoker } from './handler-invoker';

describe('HandlerInvoker', () => {
    let invoker: HandlerInvoker;

    let parameterGenerator: jest.Mocked<ParameterGenerator>;
    let pipeGenerator: jest.Mocked<PipeGenerator>;
    let pipeProcessor: jest.Mocked<PipeProcessor>;
    let injector: jest.Mocked<Injector>;
    let instance: { execute: jest.Mock };

    let context: ExecutionContext;

    class Handler {
        execute(...args: unknown[]): unknown {
            return args;
        }
    }

    const handler = { target: Handler, propertyKey: 'execute' } as ExecutionHandler;
    const template = ParameterDefinition.fromMetadata({ target: Handler, propertyKey: 'execute', parameterIndex: 0, parameter: 'body' } as any);
    const steps = [{ pipeStep: class Step {} as any }];

    beforeEach(() => {
        parameterGenerator = {
            generate: jest.fn().mockReturnValue([template]),
            resolve: jest.fn().mockImplementation((_context, definition: ParameterDefinition) => {
                const resolved = definition.clone();
                resolved.setValue('resolved');
                return resolved;
            })
        } as unknown as jest.Mocked<ParameterGenerator>;
        pipeGenerator = {
            generate: jest.fn().mockImplementation(async (parameters: ParameterDefinition[]) => parameters.map((p) => new PipeDefinition(p, steps)))
        } as unknown as jest.Mocked<PipeGenerator>;
        pipeProcessor = { process: jest.fn().mockResolvedValue(['first', 123]) } as unknown as jest.Mocked<PipeProcessor>;
        instance = { execute: jest.fn().mockReturnValue('result'), other: jest.fn() } as any;
        injector = { get: jest.fn().mockResolvedValue(instance), isSingleton: jest.fn().mockReturnValue(false) } as unknown as jest.Mocked<Injector>;

        invoker = new HandlerInvoker(parameterGenerator, pipeGenerator, pipeProcessor, injector);
        context = { target: Handler, propertyKey: 'execute', scopedContainer: {} } as unknown as ExecutionContext;
    });

    it('generates the parameters without values and the pipes once per handler', async () => {
        await invoker.invoke(handler, context);
        await invoker.invoke({ ...handler }, context);

        expect(parameterGenerator.generate).toHaveBeenCalledTimes(1);
        expect(parameterGenerator.generate).toHaveBeenCalledWith(undefined, handler, false);
        expect(pipeGenerator.generate).toHaveBeenCalledTimes(1);
        expect(pipeGenerator.generate).toHaveBeenCalledWith([template], handler);
    });

    it('prepares each handler of a class separately', async () => {
        await invoker.invoke(handler, context);
        await invoker.invoke({ target: Handler, propertyKey: 'other' }, context);
        await invoker.invoke({ target: class Other {}, propertyKey: 'execute' }, context);

        expect(parameterGenerator.generate).toHaveBeenCalledTimes(3);
    });

    it('generates the pipes once for concurrent first invocations', async () => {
        await Promise.all([invoker.invoke(handler, context), invoker.invoke(handler, context)]);

        expect(pipeGenerator.generate).toHaveBeenCalledTimes(1);
    });

    it('resolves a copy of the parameters for each invocation and processes their pipes', async () => {
        await invoker.invoke(handler, context);
        await invoker.invoke(handler, context);

        expect(parameterGenerator.resolve).toHaveBeenCalledWith(context, template);
        const [first] = pipeProcessor.process.mock.calls[0][0];
        const [second] = pipeProcessor.process.mock.calls[1][0];
        expect(first.parameter).not.toBe(template);
        expect(first.parameter).not.toBe(second.parameter);
        expect(first.parameter.value).toBe('resolved');
        expect(first.steps).toBe(steps);
        expect(pipeProcessor.process.mock.calls[0][1]).toBe(context);
        expect(template.value).toBeUndefined();
    });

    it('invokes the handler instance resolved with the scoped container and returns its result', async () => {
        await expect(invoker.invoke(handler, context)).resolves.toBe('result');

        expect(injector.get).toHaveBeenCalledWith(Handler, context.scopedContainer);
        expect(instance.execute).toHaveBeenCalledWith('first', 123);
    });

    it('supports a symbol property key', async () => {
        const propertyKey = Symbol('execute');
        const symbolInstance = { [propertyKey]: jest.fn().mockReturnValue('symbol') };
        injector.get.mockResolvedValue(symbolInstance);
        pipeProcessor.process.mockResolvedValue([]);

        await expect(invoker.invoke({ target: Handler, propertyKey }, context)).resolves.toBe('symbol');
        expect(symbolInstance[propertyKey]).toHaveBeenCalledWith();
    });

    it('generates the pipes again after a failed preparation', async () => {
        const error = new Error('pipes');
        pipeGenerator.generate.mockRejectedValueOnce(error);

        await expect(invoker.invoke(handler, context)).rejects.toBe(error);
        await expect(invoker.invoke(handler, context)).resolves.toBe('result');
        expect(pipeGenerator.generate).toHaveBeenCalledTimes(2);
    });

    it('propagates the errors of the pipe processor, the injector and the handler', async () => {
        const error = new Error('failure');
        pipeProcessor.process.mockRejectedValueOnce(error);
        await expect(invoker.invoke(handler, context)).rejects.toBe(error);
        expect(injector.get).not.toHaveBeenCalled();

        injector.get.mockRejectedValueOnce(error);
        await expect(invoker.invoke(handler, context)).rejects.toBe(error);

        instance.execute.mockRejectedValueOnce(error);
        await expect(invoker.invoke(handler, context)).rejects.toBe(error);
    });
    describe('target instances', () => {
        it('resolves a singleton target once and reuses it in the next invocations', async () => {
            injector.isSingleton.mockReturnValue(true);

            await expect(invoker.invoke(handler, context)).resolves.toBe('result');
            await expect(invoker.invoke(handler, { ...context, scopedContainer: {} } as ExecutionContext)).resolves.toBe('result');

            expect(injector.get).toHaveBeenCalledTimes(1);
            expect(injector.isSingleton).toHaveBeenCalledWith(Handler);
        });

        it('resolves the scoped and transient targets in every invocation', async () => {
            const other = { ...context, scopedContainer: {} } as ExecutionContext;

            await invoker.invoke(handler, context);
            await invoker.invoke(handler, other);

            expect(injector.get).toHaveBeenCalledTimes(2);
            expect(injector.get).toHaveBeenLastCalledWith(Handler, other.scopedContainer);
        });
    });
});
