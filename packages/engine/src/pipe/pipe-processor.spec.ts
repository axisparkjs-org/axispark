import { Injector } from '@axisparkjs/di';
import { ExecutionContext } from '../execution';
import { ParameterDefinition } from '../parameter';
import { PipeDefinition } from './pipe-definition';
import { PipeProcessor } from './pipe-processor';
import { PipeStep, PipeStepConfig, PipeStepSkip } from './pipe-step';

describe('PipeProcessor', () => {
    let processor: PipeProcessor;
    let injector: jest.Mocked<Injector>;
    let context: ExecutionContext;

    class FirstPipeStep implements PipeStep {
        async execute(parameter: ParameterDefinition, _config?: PipeStepConfig): Promise<any> {
            return parameter.value;
        }
    }

    class SecondPipeStep implements PipeStep {
        async execute(parameter: ParameterDefinition, _config?: PipeStepConfig): Promise<any> {
            return parameter.value;
        }
    }

    beforeEach(() => {
        injector = {
            get: jest.fn()
        } as unknown as jest.Mocked<Injector>;

        processor = new PipeProcessor(injector);

        context = {
            scopedContainer: {}
        } as ExecutionContext;
    });

    describe('process', () => {
        it('should return an empty array when there are no pipes', async () => {
            const result = await processor.process([], context);

            expect(result).toEqual([]);
            expect(injector.get).not.toHaveBeenCalled();
        });

        it('should return the parameters when a pipe has no steps', async () => {
            const parameter = ParameterDefinition.fromMetadata({
                target: class Target {},
                propertyKey: 'execute',
                parameterIndex: 0,
                parameter: 'value'
            });

            parameter.setValue('test');

            const pipe = new PipeDefinition(parameter, []);

            const result = await processor.process([pipe], context);

            expect(result).toEqual([parameter.value]);
            expect(result[0]).toBe(parameter.value);
            expect(injector.get).not.toHaveBeenCalled();
        });

        it('should resolve a pipe step from the injector', async () => {
            const parameter = ParameterDefinition.fromMetadata({
                target: class Target {},
                propertyKey: 'execute',
                parameterIndex: 0,
                parameter: 'value'
            });

            parameter.setValue('test');

            const pipeStep = {
                execute: jest.fn().mockResolvedValue('result')
            };

            injector.get.mockResolvedValue(pipeStep as any);

            const pipe = new PipeDefinition(parameter, [
                {
                    pipeStep: FirstPipeStep
                }
            ]);

            await processor.process([pipe], context);

            expect(injector.get).toHaveBeenCalledTimes(1);
            expect(injector.get).toHaveBeenCalledWith(FirstPipeStep, context.scopedContainer);
        });

        it('should execute the pipe step with the parameter and config', async () => {
            const parameter = ParameterDefinition.fromMetadata({
                target: class Target {},
                propertyKey: 'execute',
                parameterIndex: 0,
                parameter: 'value'
            });

            parameter.setValue('input');

            const config = {
                foo: 'bar'
            } as PipeStepConfig;

            const pipeStep = {
                execute: jest.fn().mockResolvedValue('output')
            };

            injector.get.mockResolvedValue(pipeStep as any);

            const pipe = new PipeDefinition(parameter, [
                {
                    pipeStep: FirstPipeStep,
                    pipeStepConfig: config
                }
            ]);

            await processor.process([pipe], context);

            expect(pipeStep.execute).toHaveBeenCalledTimes(1);
            expect(pipeStep.execute).toHaveBeenCalledWith(parameter, config, context);
        });

        it('should execute a pipe step without config', async () => {
            const parameter = ParameterDefinition.fromMetadata({
                target: class Target {},
                propertyKey: 'execute',
                parameterIndex: 0,
                parameter: 'value'
            });

            parameter.setValue('input');

            const pipeStep = {
                execute: jest.fn().mockResolvedValue('output')
            };

            injector.get.mockResolvedValue(pipeStep as any);

            const pipe = new PipeDefinition(parameter, [
                {
                    pipeStep: FirstPipeStep
                }
            ]);

            await processor.process([pipe], context);

            expect(pipeStep.execute).toHaveBeenCalledWith(parameter, undefined, context);
        });

        it('should update the parameter with the result of the pipe step', async () => {
            const parameter = ParameterDefinition.fromMetadata({
                target: class Target {},
                propertyKey: 'execute',
                parameterIndex: 0,
                parameter: 'value'
            });

            parameter.setValue('input');

            const pipeStep = {
                execute: jest.fn().mockResolvedValue('output')
            };

            injector.get.mockResolvedValue(pipeStep as any);

            const pipe = new PipeDefinition(parameter, [
                {
                    pipeStep: FirstPipeStep
                }
            ]);

            await processor.process([pipe], context);

            expect(parameter.value).toBe('output');
            expect(parameter.originalValue).toBe('input');
        });

        it('should execute multiple pipe steps sequentially', async () => {
            const parameter = ParameterDefinition.fromMetadata({
                target: class Target {},
                propertyKey: 'execute',
                parameterIndex: 0,
                parameter: 'input'
            });

            parameter.setValue('input');

            const firstStep = {
                execute: jest.fn().mockResolvedValue('first')
            };

            const secondStep = {
                execute: jest.fn().mockResolvedValue('second')
            };

            injector.get.mockResolvedValueOnce(firstStep as any).mockResolvedValueOnce(secondStep as any);

            const pipe = new PipeDefinition(parameter, [
                {
                    pipeStep: FirstPipeStep
                },
                {
                    pipeStep: SecondPipeStep
                }
            ]);

            await processor.process([pipe], context);

            expect(injector.get).toHaveBeenNthCalledWith(1, FirstPipeStep, context.scopedContainer);

            expect(injector.get).toHaveBeenNthCalledWith(2, SecondPipeStep, context.scopedContainer);

            expect(firstStep.execute).toHaveBeenCalledWith(parameter, undefined, context);

            expect(secondStep.execute).toHaveBeenCalledWith(parameter, undefined, context);

            expect(parameter.value).toBe('second');
            expect(parameter.originalValue).toBe('input');
        });

        it('should pass the updated parameter to the next pipe step', async () => {
            const parameter = ParameterDefinition.fromMetadata({
                target: class Target {},
                propertyKey: 'execute',
                parameterIndex: 0,
                parameter: 'value'
            });

            parameter.setValue('input');

            const firstStep = {
                execute: jest.fn().mockResolvedValue('first')
            };

            const secondStep = {
                execute: jest.fn().mockImplementation(async (parameter: ParameterDefinition) => {
                    expect(parameter.value).toBe('first');
                    return 'second';
                })
            };

            injector.get.mockResolvedValueOnce(firstStep as any).mockResolvedValueOnce(secondStep as any);

            const pipe = new PipeDefinition(parameter, [
                {
                    pipeStep: FirstPipeStep
                },
                {
                    pipeStep: SecondPipeStep
                }
            ]);

            await processor.process([pipe], context);

            expect(secondStep.execute).toHaveBeenCalledWith(parameter, undefined, context);

            expect(parameter.value).toBe('second');
        });

        it('should process multiple pipes', async () => {
            const firstParameter = ParameterDefinition.fromMetadata({
                target: class Target {},
                propertyKey: 'execute',
                parameterIndex: 0,
                parameter: 'first'
            });

            const secondParameter = ParameterDefinition.fromMetadata({
                target: class Target {},
                propertyKey: 'execute',
                parameterIndex: 1,
                parameter: 'second'
            });

            firstParameter.setValue('first-input');
            secondParameter.setValue('second-input');

            const firstStep = {
                execute: jest.fn().mockResolvedValue('first-output')
            };

            const secondStep = {
                execute: jest.fn().mockResolvedValue('second-output')
            };

            injector.get.mockResolvedValueOnce(firstStep as any).mockResolvedValueOnce(secondStep as any);

            const pipes = [
                new PipeDefinition(firstParameter, [
                    {
                        pipeStep: FirstPipeStep
                    }
                ]),
                new PipeDefinition(secondParameter, [
                    {
                        pipeStep: SecondPipeStep
                    }
                ])
            ];

            const result = await processor.process(pipes, context);

            expect(result).toEqual([firstParameter.value, secondParameter.value]);

            expect(firstParameter.value).toBe('first-output');
            expect(secondParameter.value).toBe('second-output');
        });

        it('should return the same Parameter instances', async () => {
            const parameter = ParameterDefinition.fromMetadata({
                target: class Target {},
                propertyKey: 'execute',
                parameterIndex: 0,
                parameter: 'value'
            });

            parameter.setValue('input');

            const pipe = new PipeDefinition(parameter, []);

            const result = await processor.process([pipe], context);

            expect(result[0]).toBe(parameter.value);
        });

        it('should propagate an error thrown by the pipe step', async () => {
            const error = new Error('Pipe step failed');

            const parameter = ParameterDefinition.fromMetadata({
                target: class Target {},
                propertyKey: 'execute',
                parameterIndex: 0,
                parameter: 'value'
            });

            parameter.setValue('input');

            const pipeStep = {
                execute: jest.fn().mockRejectedValue(error)
            };

            injector.get.mockResolvedValue(pipeStep as any);

            const pipe = new PipeDefinition(parameter, [
                {
                    pipeStep: FirstPipeStep
                }
            ]);

            await expect(processor.process([pipe], context)).rejects.toBe(error);
        });

        it('should stop processing subsequent steps when a step fails', async () => {
            const error = new Error('Pipe step failed');

            const parameter = ParameterDefinition.fromMetadata({
                target: class Target {},
                propertyKey: 'execute',
                parameterIndex: 0,
                parameter: 'value'
            });

            parameter.setValue('input');

            const firstStep = {
                execute: jest.fn().mockRejectedValue(error)
            };

            const secondStep = {
                execute: jest.fn().mockResolvedValue('second')
            };

            injector.get.mockResolvedValueOnce(firstStep as any).mockResolvedValueOnce(secondStep as any);

            const pipe = new PipeDefinition(parameter, [
                {
                    pipeStep: FirstPipeStep
                },
                {
                    pipeStep: SecondPipeStep
                }
            ]);

            await expect(processor.process([pipe], context)).rejects.toBe(error);

            expect(secondStep.execute).not.toHaveBeenCalled();
        });

        it('should stop processing subsequent pipes when a step fails', async () => {
            const error = new Error('Pipe step failed');

            const firstParameter = ParameterDefinition.fromMetadata({
                target: class Target {},
                propertyKey: 'execute',
                parameterIndex: 0,
                parameter: 'first'
            });

            const secondParameter = ParameterDefinition.fromMetadata({
                target: class Target {},
                propertyKey: 'execute',
                parameterIndex: 1,
                parameter: 'second'
            });

            const firstStep = {
                execute: jest.fn().mockRejectedValue(error)
            };

            const secondStep = {
                execute: jest.fn().mockResolvedValue('second')
            };

            injector.get.mockResolvedValueOnce(firstStep as any).mockResolvedValueOnce(secondStep as any);

            const pipes = [
                new PipeDefinition(firstParameter, [
                    {
                        pipeStep: FirstPipeStep
                    }
                ]),
                new PipeDefinition(secondParameter, [
                    {
                        pipeStep: SecondPipeStep
                    }
                ])
            ];

            await expect(processor.process(pipes, context)).rejects.toBe(error);

            expect(secondStep.execute).not.toHaveBeenCalled();
        });

        it('should skip the rest of the steps of a parameter when a step returns PipeStepSkip', async () => {
            const parameter = ParameterDefinition.fromMetadata({ target: class Target {}, propertyKey: 'execute', parameterIndex: 0, parameter: 'value' });
            const other = ParameterDefinition.fromMetadata({ target: class Target {}, propertyKey: 'execute', parameterIndex: 1, parameter: 'other' });
            other.setValue('other');

            const skipStep = { execute: jest.fn().mockReturnValue(PipeStepSkip) };
            const nextStep = { execute: jest.fn().mockReturnValue('never') };
            const otherStep = { execute: jest.fn().mockReturnValue('parsed') };
            injector.get.mockResolvedValueOnce(skipStep as any).mockResolvedValueOnce(otherStep as any);

            const result = await processor.process(
                [
                    new PipeDefinition(parameter, [{ pipeStep: FirstPipeStep }, { pipeStep: SecondPipeStep }]),
                    new PipeDefinition(other, [{ pipeStep: SecondPipeStep }])
                ],
                context
            );

            expect(result).toEqual([undefined, 'parsed']);
            expect(nextStep.execute).not.toHaveBeenCalled();
            expect(injector.get).toHaveBeenCalledTimes(2);
        });
    });
});
