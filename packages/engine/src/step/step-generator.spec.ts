import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { ClassRegistry } from '@axisparkjs/di';
import { ExecutionContext, ExecutionTransport } from '../execution';
import { StepGenerator } from './step-generator';
import { StepType, HandleStepDefinition, CheckStepDefinition } from './step-definition';

jest.mock('@axisparkjs/common', () => ({
    Metadata: {
        get: jest.fn(),
        define: jest.fn(),
        normalizeTarget: jest.fn((target) => target)
    },
    MetadataKeys: {
        STEP_TARGET: 'STEP_TARGET',
        STEP_METHOD: 'STEP_METHOD',
        USE: 'USE'
    }
}));

jest.mock('@axisparkjs/di', () => {
    const originalModule = jest.requireActual('@axisparkjs/di');

    return {
        ...originalModule,
        ClassRegistry: {
            getWithMetadata: jest.fn()
        }
    };
});

describe('StepGenerator', () => {
    let generator: StepGenerator;

    beforeEach(() => {
        jest.clearAllMocks();
        generator = new StepGenerator();

        (ClassRegistry.getWithMetadata as jest.Mock).mockReturnValue([]);
    });

    describe('generate', () => {
        it('should register global execution steps', () => {
            class GlobalStep {}

            (ClassRegistry.getWithMetadata as jest.Mock).mockReturnValue([GlobalStep]);

            (Metadata.get as jest.Mock)
                // STEP_TARGET
                .mockReturnValueOnce([
                    {
                        type: StepType.Middleware,
                        global: true,
                        priority: 100,
                        transport: ExecutionTransport.All
                    }
                ])
                // STEP_METHOD
                .mockReturnValueOnce([
                    {
                        type: StepType.Middleware,
                        target: GlobalStep,
                        propertyKey: 'execute'
                    }
                ]);

            const steps = generator.generate({
                target: class Controller {},
                propertyKey: 'find',
                transport: ExecutionTransport.Http
            } as ExecutionContext);

            expect(steps).toHaveLength(1);
            expect(steps[0]).toBeInstanceOf(HandleStepDefinition);
            expect(steps[0]).toEqual(
                expect.objectContaining({
                    global: true,
                    priority: 100,
                    transport: ExecutionTransport.All,
                    type: StepType.Middleware,
                    target: GlobalStep,
                    propertyKey: 'execute'
                })
            );
        });

        it('should ignore non-global execution steps', () => {
            class StepTarget {}

            (ClassRegistry.getWithMetadata as jest.Mock).mockReturnValue([StepTarget]);

            (Metadata.get as jest.Mock)
                // STEP_TARGET
                .mockReturnValueOnce([
                    {
                        type: StepType.Guard,
                        global: false,
                        priority: 10,
                        transport: ExecutionTransport.All
                    }
                ])
                // STEP_METHOD
                .mockReturnValueOnce([
                    {
                        type: StepType.Guard,
                        target: StepTarget,
                        propertyKey: 'check'
                    }
                ]);

            const steps = generator.generate({
                target: class Controller {},
                propertyKey: 'find',
                transport: ExecutionTransport.Http
            } as ExecutionContext);

            expect(steps).toEqual([]);
        });
    });

    describe('local steps', () => {
        it('should generate local execution steps from @Use', () => {
            class LocalStep {}
            class Controller {}

            (Metadata.get as jest.Mock)
                // USE - class
                .mockReturnValueOnce({
                    targets: [LocalStep]
                })
                // USE - method
                .mockReturnValueOnce(undefined)
                // STEP_TARGET
                .mockReturnValueOnce([
                    {
                        type: StepType.Guard,
                        global: false,
                        transport: ExecutionTransport.Http
                    }
                ])
                // STEP_METHOD
                .mockReturnValueOnce([
                    {
                        type: StepType.Guard,
                        target: LocalStep,
                        propertyKey: 'check'
                    }
                ]);

            const result = generator.generate({
                target: Controller,
                propertyKey: 'find',
                transport: ExecutionTransport.Http
            } as ExecutionContext);

            expect(result).toHaveLength(1);
            expect(result[0]).toBeInstanceOf(CheckStepDefinition);
            expect(result[0]).toEqual(
                expect.objectContaining({
                    global: false,
                    priority: 0,
                    transport: ExecutionTransport.Http,
                    type: StepType.Guard,
                    target: LocalStep,
                    propertyKey: 'check'
                })
            );
        });

        it('should merge class and method targets', () => {
            class Step1 {}
            class Step2 {}
            class Controller {}

            (Metadata.get as jest.Mock)
                // USE - class
                .mockReturnValueOnce({
                    targets: [Step1]
                })
                // USE - method
                .mockReturnValueOnce({
                    targets: [Step2]
                })
                // STEP_TARGET - Step1
                .mockReturnValueOnce(undefined)
                // STEP_METHOD - Step1
                .mockReturnValueOnce(undefined)
                // STEP_TARGET - Step2
                .mockReturnValueOnce(undefined)
                // STEP_METHOD - Step2
                .mockReturnValueOnce(undefined);

            const result = generator.generate({
                target: Controller,
                propertyKey: 'find',
                transport: ExecutionTransport.Http
            } as ExecutionContext);

            expect(Metadata.get).toHaveBeenCalledWith(MetadataKeys.USE, Controller);

            expect(Metadata.get).toHaveBeenCalledWith(MetadataKeys.USE, Controller, 'find');

            expect(result).toEqual([]);
        });

        it('should ignore methods with different step type', () => {
            class StepTarget {}
            class Controller {}

            (Metadata.get as jest.Mock)
                // USE - class
                .mockReturnValueOnce({
                    targets: [StepTarget]
                })
                // USE - method
                .mockReturnValueOnce(undefined)
                // STEP_TARGET
                .mockReturnValueOnce([
                    {
                        type: StepType.Guard,
                        global: false,
                        transport: ExecutionTransport.All
                    }
                ])
                // STEP_METHOD
                .mockReturnValueOnce([
                    {
                        type: StepType.Middleware,
                        target: StepTarget,
                        propertyKey: 'execute'
                    }
                ]);

            const result = generator.generate({
                target: Controller,
                propertyKey: 'find',
                transport: ExecutionTransport.Http
            } as ExecutionContext);

            expect(result).toEqual([]);
        });

        it('should return global and local execution steps', () => {
            class GlobalStep {}
            class LocalStep {}
            class Controller {}

            (ClassRegistry.getWithMetadata as jest.Mock).mockReturnValue([GlobalStep]);

            (Metadata.get as jest.Mock)
                // global - STEP_TARGET
                .mockReturnValueOnce([
                    {
                        type: StepType.Middleware,
                        global: true,
                        priority: 10,
                        transport: ExecutionTransport.All
                    }
                ])
                // global - STEP_METHOD
                .mockReturnValueOnce([
                    {
                        type: StepType.Middleware,
                        target: GlobalStep,
                        propertyKey: 'before'
                    }
                ])
                // local - USE class
                .mockReturnValueOnce({
                    targets: [LocalStep]
                })
                // local - USE method
                .mockReturnValueOnce(undefined)
                // local - STEP_TARGET
                .mockReturnValueOnce([
                    {
                        type: StepType.Guard,
                        global: false,
                        transport: ExecutionTransport.Http
                    }
                ])
                // local - STEP_METHOD
                .mockReturnValueOnce([
                    {
                        type: StepType.Guard,
                        target: LocalStep,
                        propertyKey: 'check'
                    }
                ]);

            const result = generator.generate({
                target: Controller,
                propertyKey: 'find',
                transport: ExecutionTransport.Http
            } as ExecutionContext);

            expect(result).toHaveLength(2);

            expect(result[0]).toBeInstanceOf(HandleStepDefinition);
            expect(result[0]).toEqual(
                expect.objectContaining({
                    global: true,
                    priority: 10,
                    type: StepType.Middleware,
                    target: GlobalStep,
                    propertyKey: 'before'
                })
            );

            expect(result[1]).toBeInstanceOf(CheckStepDefinition);
            expect(result[1]).toEqual(
                expect.objectContaining({
                    global: false,
                    priority: 0,
                    type: StepType.Guard,
                    target: LocalStep,
                    propertyKey: 'check'
                })
            );
        });
    });

    describe('global steps cache', () => {
        it('should cache global steps between generate calls', () => {
            class GlobalStep {}

            (ClassRegistry.getWithMetadata as jest.Mock).mockReturnValue([GlobalStep]);

            (Metadata.get as jest.Mock)
                // First generate - STEP_TARGET
                .mockReturnValueOnce([
                    {
                        type: StepType.Middleware,
                        global: true,
                        priority: 10,
                        transport: ExecutionTransport.All
                    }
                ])
                // First generate - STEP_METHOD
                .mockReturnValueOnce([
                    {
                        type: StepType.Middleware,
                        target: GlobalStep,
                        propertyKey: 'execute'
                    }
                ])
                // Second generate - USE class
                .mockReturnValueOnce(undefined)
                // Second generate - USE method
                .mockReturnValueOnce(undefined);

            const context = {
                target: class Controller {},
                propertyKey: 'find',
                transport: ExecutionTransport.Http
            } as ExecutionContext;

            const firstResult = generator.generate(context);
            const secondResult = generator.generate(context);

            expect(firstResult).toEqual(secondResult);
            expect(ClassRegistry.getWithMetadata).toHaveBeenCalledTimes(1);
        });
        it('should scan the registry once also when there are no global steps', () => {
            const context = { target: class Controller {}, propertyKey: 'find', transport: ExecutionTransport.Http } as ExecutionContext;

            expect(generator.generate(context)).toEqual([]);
            expect(generator.generate(context)).toEqual([]);
            expect(ClassRegistry.getWithMetadata).toHaveBeenCalledTimes(1);
        });
    });
});
