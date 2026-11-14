import { Injector } from '@axisparkjs/di';
import { ParameterGenerator } from '../parameter';
import { PipeGenerator, PipeProcessor } from '../pipe';
import { ExecutionContext } from './execution-context';
import { ExecutionHandler } from './execution-handler';
import { HandlerInvoker } from './handler-invoker';

describe('HandlerInvoker', () => {
    let invoker: HandlerInvoker;

    let parameterGenerator: jest.Mocked<ParameterGenerator>;
    let pipeGenerator: jest.Mocked<PipeGenerator>;
    let pipeProcessor: jest.Mocked<PipeProcessor>;
    let injector: jest.Mocked<Injector>;

    let context: ExecutionContext;

    class Handler {
        execute(...args: unknown[]): unknown {
            return args;
        }
    }

    const handler = {
        target: Handler,
        propertyKey: 'execute'
    } as ExecutionHandler;

    beforeEach(() => {
        parameterGenerator = {
            generate: jest.fn()
        } as unknown as jest.Mocked<ParameterGenerator>;

        pipeGenerator = {
            generate: jest.fn()
        } as unknown as jest.Mocked<PipeGenerator>;

        pipeProcessor = {
            process: jest.fn()
        } as unknown as jest.Mocked<PipeProcessor>;

        injector = {
            get: jest.fn(),
            isSingleton: jest.fn().mockReturnValue(false)
        } as unknown as jest.Mocked<Injector>;

        invoker = new HandlerInvoker(parameterGenerator, pipeGenerator, pipeProcessor, injector);

        context = {
            target: class Controller {},
            propertyKey: 'execute',
            scopedContainer: {}
        } as ExecutionContext;
    });

    describe('invoke', () => {
        it('should generate parameters using the context and handler', async () => {
            const parameters: any = [];

            parameterGenerator.generate.mockReturnValue(parameters);

            pipeGenerator.generate.mockResolvedValue([]);
            pipeProcessor.process.mockResolvedValue([]);

            const instance = {
                execute: jest.fn().mockResolvedValue('result')
            };

            injector.get.mockResolvedValue(instance);

            await invoker.invoke(handler, context);

            expect(parameterGenerator.generate).toHaveBeenCalledTimes(1);
            expect(parameterGenerator.generate).toHaveBeenCalledWith(context, handler);
        });

        it('should generate pipes using the generated parameters and context', async () => {
            const parameters = [
                {
                    parameterIndex: 0
                }
            ];

            parameterGenerator.generate.mockReturnValue(parameters as any);
            pipeGenerator.generate.mockResolvedValue([]);
            pipeProcessor.process.mockResolvedValue([]);

            const instance = {
                execute: jest.fn().mockResolvedValue('result')
            };

            injector.get.mockResolvedValue(instance);

            await invoker.invoke(handler, context);

            expect(pipeGenerator.generate).toHaveBeenCalledTimes(1);
            expect(pipeGenerator.generate).toHaveBeenCalledWith(parameters, handler);
        });

        it('should process the generated pipes', async () => {
            const parameters = [
                {
                    parameterIndex: 0
                }
            ];

            const pipes = [
                {
                    parameter: parameters[0],
                    steps: []
                }
            ];

            parameterGenerator.generate.mockReturnValue(parameters as any);
            pipeGenerator.generate.mockResolvedValue(pipes as any);
            pipeProcessor.process.mockResolvedValue([]);

            const instance = {
                execute: jest.fn().mockResolvedValue('result')
            };

            injector.get.mockResolvedValue(instance);

            await invoker.invoke(handler, context);

            expect(pipeProcessor.process).toHaveBeenCalledTimes(1);
            expect(pipeProcessor.process).toHaveBeenCalledWith(pipes, context);
        });

        it('should resolve the handler instance using the scoped container', async () => {
            parameterGenerator.generate.mockReturnValue([]);
            pipeGenerator.generate.mockResolvedValue([]);
            pipeProcessor.process.mockResolvedValue([]);

            const instance = {
                execute: jest.fn().mockResolvedValue('result')
            };

            injector.get.mockResolvedValue(instance);

            await invoker.invoke(handler, context);

            expect(injector.get).toHaveBeenCalledTimes(1);
            expect(injector.get).toHaveBeenCalledWith(handler.target, context.scopedContainer);
        });

        it('should invoke the handler method with the processed arguments', async () => {
            const args = ['first', 123, { value: true }];

            parameterGenerator.generate.mockReturnValue([]);
            pipeGenerator.generate.mockResolvedValue([]);
            pipeProcessor.process.mockResolvedValue(args as any);

            const instance = {
                execute: jest.fn().mockResolvedValue('result')
            };

            injector.get.mockResolvedValue(instance);

            await invoker.invoke(handler, context);

            expect(instance.execute).toHaveBeenCalledTimes(1);
            expect(instance.execute).toHaveBeenCalledWith('first', 123, { value: true });
        });

        it('should return the result of the handler method', async () => {
            const result = {
                value: 'result'
            };

            parameterGenerator.generate.mockReturnValue([]);
            pipeGenerator.generate.mockResolvedValue([]);
            pipeProcessor.process.mockResolvedValue([]);

            const instance = {
                execute: jest.fn().mockResolvedValue(result)
            };

            injector.get.mockResolvedValue(instance);

            const actual = await invoker.invoke(handler, context);

            expect(actual).toBe(result);
        });

        it('should support a synchronous handler result', async () => {
            const result = 'sync-result';

            parameterGenerator.generate.mockReturnValue([]);
            pipeGenerator.generate.mockResolvedValue([]);
            pipeProcessor.process.mockResolvedValue([]);

            const instance = {
                execute: jest.fn().mockReturnValue(result)
            };

            injector.get.mockResolvedValue(instance);

            const actual = await invoker.invoke(handler, context);

            expect(actual).toBe(result);
        });

        it('should support a symbol property key', async () => {
            const propertyKey = Symbol('execute');

            const symbolHandler = {
                target: Handler,
                propertyKey
            } as ExecutionHandler;

            const instance = {
                [propertyKey]: jest.fn().mockResolvedValue('result')
            };

            parameterGenerator.generate.mockReturnValue([]);
            pipeGenerator.generate.mockResolvedValue([]);
            pipeProcessor.process.mockResolvedValue([]);
            injector.get.mockResolvedValue(instance);

            const result = await invoker.invoke(symbolHandler, context);

            expect(instance[propertyKey]).toHaveBeenCalledWith();
            expect(result).toBe('result');
        });

        it('should execute the dependencies in the correct order', async () => {
            const calls: string[] = [];

            const parameters = ['parameter'];
            const pipes = ['pipe'];
            const args = ['argument'];

            parameterGenerator.generate.mockImplementation(() => {
                calls.push('parameters');
                return parameters as any;
            });

            pipeGenerator.generate.mockImplementation(async () => {
                calls.push('pipes');
                return pipes as any;
            });

            pipeProcessor.process.mockImplementation(async () => {
                calls.push('process');
                return args as any;
            });

            const instance = {
                execute: jest.fn().mockImplementation(() => {
                    calls.push('handler');
                    return 'result';
                })
            };

            injector.get.mockImplementation(async () => {
                calls.push('injector');
                return instance;
            });

            await invoker.invoke(handler, context);

            expect(calls).toEqual(['parameters', 'pipes', 'process', 'injector', 'handler']);
        });

        it('should propagate an error from the parameter generator', async () => {
            const error = new Error('Parameter generation failed');

            parameterGenerator.generate.mockImplementation(() => {
                throw error;
            });

            await expect(invoker.invoke(handler, context)).rejects.toBe(error);

            expect(pipeGenerator.generate).not.toHaveBeenCalled();
            expect(pipeProcessor.process).not.toHaveBeenCalled();
            expect(injector.get).not.toHaveBeenCalled();
        });

        it('should propagate an error from the pipe generator', async () => {
            const error = new Error('Pipe generation failed');

            parameterGenerator.generate.mockReturnValue([]);

            pipeGenerator.generate.mockRejectedValue(error);

            await expect(invoker.invoke(handler, context)).rejects.toBe(error);

            expect(pipeProcessor.process).not.toHaveBeenCalled();
            expect(injector.get).not.toHaveBeenCalled();
        });

        it('should propagate an error from the pipe processor', async () => {
            const error = new Error('Pipe processing failed');

            parameterGenerator.generate.mockReturnValue([]);
            pipeGenerator.generate.mockResolvedValue([]);
            pipeProcessor.process.mockRejectedValue(error);

            await expect(invoker.invoke(handler, context)).rejects.toBe(error);

            expect(injector.get).not.toHaveBeenCalled();
        });

        it('should propagate an error from the injector', async () => {
            const error = new Error('Handler resolution failed');

            parameterGenerator.generate.mockReturnValue([]);
            pipeGenerator.generate.mockResolvedValue([]);
            pipeProcessor.process.mockResolvedValue([]);
            injector.get.mockRejectedValue(error);

            await expect(invoker.invoke(handler, context)).rejects.toBe(error);
        });

        it('should propagate an error from the handler method', async () => {
            const error = new Error('Handler execution failed');

            parameterGenerator.generate.mockReturnValue([]);
            pipeGenerator.generate.mockResolvedValue([]);
            pipeProcessor.process.mockResolvedValue([]);

            const instance = {
                execute: jest.fn().mockRejectedValue(error)
            };

            injector.get.mockResolvedValue(instance);

            await expect(invoker.invoke(handler, context)).rejects.toBe(error);
        });

        it('should pass no arguments when the pipe processor returns an empty array', async () => {
            parameterGenerator.generate.mockReturnValue([]);
            pipeGenerator.generate.mockResolvedValue([]);
            pipeProcessor.process.mockResolvedValue([]);

            const instance = {
                execute: jest.fn().mockResolvedValue('result')
            };

            injector.get.mockResolvedValue(instance);

            await invoker.invoke(handler, context);

            expect(instance.execute).toHaveBeenCalledWith();
        });
    });
    describe('target instances', () => {
        beforeEach(() => {
            parameterGenerator.generate.mockReturnValue([]);
            pipeGenerator.generate.mockResolvedValue([]);
            pipeProcessor.process.mockResolvedValue([]);
            injector.get.mockResolvedValue({ execute: jest.fn().mockReturnValue('result') });
        });

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
