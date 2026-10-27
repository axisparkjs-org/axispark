import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { ExecutionContext, ExecutionTransport } from '../execution';
import { ParameterDefinition } from '../parameter';
import { PipeDefinition } from './pipe-definition';
import { PipeGenerator } from './pipe-generator';
import { PipeScope } from './pipe-scope';

jest.mock('@axisparkjs/common', () => ({
    Metadata: {
        get: jest.fn(),
        define: jest.fn(),
        normalizeTarget: jest.fn((target) => target)
    },
    MetadataKeys: {
        PIPE: 'PIPE'
    }
}));

describe('PipeGenerator', () => {
    let generator: PipeGenerator;
    let context: ExecutionContext;

    class Controller {}

    class ClassPipeStep {}

    class MethodPipeStep {}

    class ParameterPipeStep {}

    class AnotherPipeStep {}

    beforeEach(() => {
        jest.clearAllMocks();

        generator = new PipeGenerator();

        context = {
            target: Controller,
            propertyKey: 'execute',
            transport: ExecutionTransport.Http
        } as ExecutionContext;
    });

    describe('generate', () => {
        it('should return an empty array when there are no parameters', async () => {
            (Metadata.get as jest.Mock).mockReturnValue([]);

            const result = await generator.generate([], context);

            expect(result).toEqual([]);
            expect(Metadata.get).toHaveBeenCalledTimes(3);
        });

        it('should create a Pipe for each parameter', async () => {
            const parameter1 = ParameterDefinition.fromMetadata({
                target: Controller,
                propertyKey: 'execute',
                parameterIndex: 0,
                parameter: 'first'
            });

            const parameter2 = ParameterDefinition.fromMetadata({
                target: Controller,
                propertyKey: 'execute',
                parameterIndex: 1,
                parameter: 'second'
            });

            (Metadata.get as jest.Mock).mockReturnValue([]);

            const result = await generator.generate([parameter1, parameter2], context);

            expect(result).toHaveLength(2);

            expect(result[0]).toBeInstanceOf(PipeDefinition);
            expect(result[1]).toBeInstanceOf(PipeDefinition);

            expect(result[0].parameter).toBe(parameter1);
            expect(result[1].parameter).toBe(parameter2);
        });

        it('should include class scoped pipes for every parameter', async () => {
            const parameter1 = ParameterDefinition.fromMetadata({
                target: Controller,
                propertyKey: 'execute',
                parameterIndex: 0,
                parameter: 'first'
            });

            const parameter2 = ParameterDefinition.fromMetadata({
                target: Controller,
                propertyKey: 'execute',
                parameterIndex: 1,
                parameter: 'second'
            });

            (Metadata.get as jest.Mock)
                .mockReturnValueOnce([
                    {
                        pipeScope: PipeScope.Class,
                        steps: [
                            {
                                pipeStep: ClassPipeStep
                            }
                        ]
                    }
                ])
                .mockReturnValueOnce([])
                .mockReturnValueOnce([]);

            const result = await generator.generate([parameter1, parameter2], context);

            expect(result).toHaveLength(2);

            expect(result[0].steps).toEqual([
                {
                    pipeStep: ClassPipeStep,
                    pipeStepConfig: undefined
                }
            ]);

            expect(result[1].steps).toEqual([
                {
                    pipeStep: ClassPipeStep,
                    pipeStepConfig: undefined
                }
            ]);
        });

        it('should include method scoped pipes', async () => {
            const parameter = ParameterDefinition.fromMetadata({
                target: Controller,
                propertyKey: 'execute',
                parameterIndex: 0,
                parameter: 'value'
            });

            (Metadata.get as jest.Mock)
                // class pipes
                .mockReturnValueOnce([])
                // method pipes
                .mockReturnValueOnce([
                    {
                        pipeScope: PipeScope.Method,
                        steps: [
                            {
                                pipeStep: MethodPipeStep
                            }
                        ]
                    }
                ])
                // parameter pipes
                .mockReturnValueOnce([]);

            const result = await generator.generate([parameter], context);

            expect(result).toHaveLength(1);

            expect(result[0].steps).toEqual([
                {
                    pipeStep: MethodPipeStep,
                    pipeStepConfig: undefined
                }
            ]);
        });

        it('should ignore method pipes with another scope', async () => {
            const parameter = ParameterDefinition.fromMetadata({
                target: Controller,
                propertyKey: 'execute',
                parameterIndex: 0,
                parameter: 'value'
            });

            (Metadata.get as jest.Mock)
                .mockReturnValueOnce([])
                .mockReturnValueOnce([
                    {
                        pipeScope: PipeScope.Parameter,
                        parameterIndex: 0,
                        steps: [
                            {
                                pipeStep: MethodPipeStep
                            }
                        ]
                    }
                ])
                .mockReturnValueOnce([]);

            const result = await generator.generate([parameter], context);

            expect(result[0].steps).toEqual([]);
        });

        it('should include parameter scoped pipes only for the matching parameter', async () => {
            const parameter1 = ParameterDefinition.fromMetadata({
                target: Controller,
                propertyKey: 'execute',
                parameterIndex: 0,
                parameter: 'first'
            });

            const parameter2 = ParameterDefinition.fromMetadata({
                target: Controller,
                propertyKey: 'execute',
                parameterIndex: 1,
                parameter: 'second'
            });

            (Metadata.get as jest.Mock)
                // class pipes
                .mockReturnValueOnce([])
                // method pipes
                .mockReturnValueOnce([])
                // parameter pipes
                .mockReturnValueOnce([
                    {
                        pipeScope: PipeScope.Parameter,
                        parameterIndex: 0,
                        steps: [
                            {
                                pipeStep: ParameterPipeStep
                            }
                        ]
                    }
                ]);

            const result = await generator.generate([parameter1, parameter2], context);

            expect(result[0].steps).toEqual([
                {
                    pipeStep: ParameterPipeStep,
                    pipeStepConfig: undefined
                }
            ]);

            expect(result[1].steps).toEqual([]);
        });

        it('should include class, method and parameter pipes in order', async () => {
            const parameter = ParameterDefinition.fromMetadata({
                target: Controller,
                propertyKey: 'execute',
                parameterIndex: 0,
                parameter: 'value'
            });

            (Metadata.get as jest.Mock)
                .mockReturnValueOnce([
                    {
                        pipeScope: PipeScope.Class,
                        steps: [
                            {
                                pipeStep: ClassPipeStep
                            }
                        ]
                    }
                ])
                .mockReturnValueOnce([
                    {
                        pipeScope: PipeScope.Method,
                        steps: [
                            {
                                pipeStep: MethodPipeStep
                            }
                        ]
                    }
                ])
                .mockReturnValueOnce([
                    {
                        pipeScope: PipeScope.Parameter,
                        parameterIndex: 0,
                        steps: [
                            {
                                pipeStep: ParameterPipeStep
                            }
                        ]
                    }
                ]);

            const result = await generator.generate([parameter], context);

            expect(result[0].steps).toEqual([
                {
                    pipeStep: ClassPipeStep,
                    pipeStepConfig: undefined
                },
                {
                    pipeStep: MethodPipeStep,
                    pipeStepConfig: undefined
                },
                {
                    pipeStep: ParameterPipeStep,
                    pipeStepConfig: undefined
                }
            ]);
        });

        it('should flatten multiple steps from the same pipe', async () => {
            const parameter = ParameterDefinition.fromMetadata({
                target: Controller,
                propertyKey: 'execute',
                parameterIndex: 0,
                parameter: 'value'
            });

            (Metadata.get as jest.Mock)
                .mockReturnValueOnce([
                    {
                        pipeScope: PipeScope.Class,
                        steps: [
                            {
                                pipeStep: ClassPipeStep
                            },
                            {
                                pipeStep: AnotherPipeStep
                            }
                        ]
                    }
                ])
                .mockReturnValueOnce([])
                .mockReturnValueOnce([]);

            const result = await generator.generate([parameter], context);

            expect(result[0].steps).toHaveLength(2);

            expect(result[0].steps[0].pipeStep).toBe(ClassPipeStep);
            expect(result[0].steps[1].pipeStep).toBe(AnotherPipeStep);
        });

        it('should support steps declared directly as a pipe step class', async () => {
            const parameter = ParameterDefinition.fromMetadata({
                target: Controller,
                propertyKey: 'execute',
                parameterIndex: 0,
                parameter: 'value'
            });

            (Metadata.get as jest.Mock)
                .mockReturnValueOnce([
                    {
                        pipeScope: PipeScope.Class,
                        steps: [ClassPipeStep]
                    }
                ])
                .mockReturnValueOnce([])
                .mockReturnValueOnce([]);

            const result = await generator.generate([parameter], context);

            expect(result[0].steps).toEqual([
                {
                    pipeStep: ClassPipeStep,
                    pipeStepConfig: undefined
                }
            ]);
        });

        it('should support a pipe step with configuration', async () => {
            const parameter = ParameterDefinition.fromMetadata({
                target: Controller,
                propertyKey: 'execute',
                parameterIndex: 0,
                parameter: 'value'
            });

            const config = {
                required: true
            };

            (Metadata.get as jest.Mock)
                .mockReturnValueOnce([
                    {
                        pipeScope: PipeScope.Class,
                        steps: [
                            {
                                pipeStep: ClassPipeStep,
                                PipeStepConfig: config
                            }
                        ]
                    }
                ])
                .mockReturnValueOnce([])
                .mockReturnValueOnce([]);

            const result = await generator.generate([parameter], context);

            expect(result[0].steps).toEqual([
                {
                    pipeStep: ClassPipeStep,
                    pipeStepConfig: config
                }
            ]);
        });

        it('should query metadata using class and method targets', async () => {
            (Metadata.get as jest.Mock).mockReturnValue([]);

            await generator.generate([], context);

            expect(Metadata.get).toHaveBeenNthCalledWith(1, MetadataKeys.PIPE, Controller);

            expect(Metadata.get).toHaveBeenNthCalledWith(2, MetadataKeys.PIPE, Controller, 'execute');

            expect(Metadata.get).toHaveBeenNthCalledWith(3, MetadataKeys.PIPE, Controller, 'execute');
        });

        it('should handle undefined metadata', async () => {
            const parameter = ParameterDefinition.fromMetadata({
                target: Controller,
                propertyKey: 'execute',
                parameterIndex: 0,
                parameter: 'value'
            });

            (Metadata.get as jest.Mock).mockReturnValue(undefined);

            const result = await generator.generate([parameter], context);

            expect(result).toHaveLength(1);
            expect(result[0]).toBeInstanceOf(PipeDefinition);
            expect(result[0].steps).toEqual([]);
        });
    });
});
