import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { Constructable } from '@axisparkjs/di';
import { Filter, Guard, Interceptor, Middleware } from './step-target';
import { StepPriority, StepType } from '../step';
import { ExecutionTransport } from '../execution';

jest.mock('@axisparkjs/common', () => ({
    Metadata: {
        get: jest.fn(),
        define: jest.fn(),
        normalizeTarget: jest.fn((target) => target)
    },
    MetadataKeys: {
        STEP_TARGET: 'STEP_TARGET',
        INJECTABLE: 'INJECTABLE'
    }
}));

jest.mock('@axisparkjs/di', () => ({
    Injectable: jest.fn(() => jest.fn()),
    Constructable: jest.fn(() => jest.fn())
}));

describe('StepTarget decorators', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        (Metadata.normalizeTarget as jest.Mock).mockImplementation((target) => target);
    });

    describe('@Middleware', () => {
        it('should define middleware metadata with default values', () => {
            (Metadata.get as jest.Mock).mockReturnValue(undefined);

            @Middleware()
            class TestMiddleware {}

            expect(Metadata.get).toHaveBeenCalledWith(MetadataKeys.STEP_TARGET, TestMiddleware);

            expect(Metadata.normalizeTarget).toHaveBeenCalledWith(TestMiddleware);

            expect(Constructable).toHaveBeenCalledWith(MetadataKeys.INJECTABLE);

            expect(Metadata.define).toHaveBeenCalledWith(
                MetadataKeys.STEP_TARGET,
                [
                    {
                        target: TestMiddleware,
                        type: StepType.Middleware,
                        transport: ExecutionTransport.All,
                        global: true,
                        priority: StepPriority.Normal
                    }
                ],
                TestMiddleware
            );
        });

        it('should define middleware metadata with custom configuration', () => {
            @Middleware({
                transport: ExecutionTransport.Http,
                global: true,
                priority: StepPriority.High
            })
            class TestMiddleware {}

            expect(Metadata.define).toHaveBeenCalledWith(
                MetadataKeys.STEP_TARGET,
                [
                    {
                        target: TestMiddleware,
                        type: StepType.Middleware,
                        transport: ExecutionTransport.Http,
                        global: true,
                        priority: StepPriority.High
                    }
                ],
                TestMiddleware
            );
        });
    });

    describe('@Guard', () => {
        it('should define guard metadata with default values', () => {
            (Metadata.get as jest.Mock).mockReturnValue(undefined);

            @Guard()
            class TestGuard {}

            expect(Metadata.define).toHaveBeenCalledWith(
                MetadataKeys.STEP_TARGET,
                [
                    {
                        target: TestGuard,
                        type: StepType.Guard,
                        transport: ExecutionTransport.All,
                        global: true,
                        priority: StepPriority.Normal
                    }
                ],
                TestGuard
            );
        });

        it('should define guard metadata with custom configuration', () => {
            @Guard({
                transport: ExecutionTransport.Http,
                global: true,
                priority: StepPriority.High
            })
            class TestGuard {}

            expect(Metadata.define).toHaveBeenCalledWith(
                MetadataKeys.STEP_TARGET,
                [
                    {
                        target: TestGuard,
                        type: StepType.Guard,
                        transport: ExecutionTransport.Http,
                        global: true,
                        priority: StepPriority.High
                    }
                ],
                TestGuard
            );
        });
    });

    describe('@Interceptor', () => {
        it('should define interceptor metadata with default values', () => {
            (Metadata.get as jest.Mock).mockReturnValue(undefined);

            @Interceptor()
            class TestInterceptor {}

            expect(Metadata.define).toHaveBeenCalledWith(
                MetadataKeys.STEP_TARGET,
                [
                    {
                        target: TestInterceptor,
                        type: StepType.Interceptor,
                        transport: ExecutionTransport.All,
                        global: true,
                        priority: StepPriority.Normal
                    }
                ],
                TestInterceptor
            );
        });

        it('should define interceptor metadata with custom configuration', () => {
            @Interceptor({
                transport: ExecutionTransport.Other,
                global: true,
                priority: StepPriority.High
            })
            class TestInterceptor {}

            expect(Metadata.define).toHaveBeenCalledWith(
                MetadataKeys.STEP_TARGET,
                [
                    {
                        target: TestInterceptor,
                        type: StepType.Interceptor,
                        transport: ExecutionTransport.Other,
                        global: true,
                        priority: StepPriority.High
                    }
                ],
                TestInterceptor
            );
        });
    });

    describe('@Filter', () => {
        it('should define filter metadata with default values', () => {
            (Metadata.get as jest.Mock).mockReturnValue(undefined);

            @Filter()
            class TestFilter {}

            expect(Metadata.define).toHaveBeenCalledWith(
                MetadataKeys.STEP_TARGET,
                [
                    {
                        target: TestFilter,
                        type: StepType.Filter,
                        transport: ExecutionTransport.All,
                        global: true,
                        priority: StepPriority.Normal
                    }
                ],
                TestFilter
            );
        });

        it('should define filter metadata with custom configuration', () => {
            @Filter({
                transport: ExecutionTransport.Http,
                global: true,
                priority: StepPriority.High
            })
            class TestFilter {}

            expect(Metadata.define).toHaveBeenCalledWith(
                MetadataKeys.STEP_TARGET,
                [
                    {
                        target: TestFilter,
                        type: StepType.Filter,
                        transport: ExecutionTransport.Http,
                        global: true,
                        priority: StepPriority.High
                    }
                ],
                TestFilter
            );
        });
    });

    describe('metadata', () => {
        it('should append metadata when metadata already exists', () => {
            class ExistingStep {}

            const existingMetadata = [
                {
                    target: ExistingStep,
                    type: StepType.Guard,
                    transport: ExecutionTransport.Http,
                    global: true,
                    priority: StepPriority.High
                }
            ];

            (Metadata.get as jest.Mock).mockReturnValue(existingMetadata);

            @Middleware()
            class TestMiddleware {}

            expect(Metadata.define).toHaveBeenCalledWith(
                MetadataKeys.STEP_TARGET,
                [
                    existingMetadata[0],
                    {
                        target: TestMiddleware,
                        type: StepType.Middleware,
                        transport: ExecutionTransport.All,
                        global: true,
                        priority: StepPriority.Normal
                    }
                ],
                TestMiddleware
            );
        });

        it('should read metadata from the decorated target', () => {
            (Metadata.get as jest.Mock).mockReturnValue([]);

            @Guard()
            class TestGuard {}

            expect(Metadata.get).toHaveBeenCalledWith(MetadataKeys.STEP_TARGET, TestGuard);
        });

        it('should normalize the decorated target', () => {
            Metadata.get = jest.fn().mockReturnValue(undefined);

            class NormalizedTarget {}

            const normalizedTarget = class NormalizedTargetResult {};

            (Metadata.normalizeTarget as jest.Mock).mockReturnValue(normalizedTarget);

            // Apply the decorator manually to control the target.
            Middleware()(NormalizedTarget);

            expect(Metadata.normalizeTarget).toHaveBeenCalledWith(NormalizedTarget);

            expect(Metadata.define).toHaveBeenCalledWith(
                MetadataKeys.STEP_TARGET,
                [
                    {
                        target: normalizedTarget,
                        type: StepType.Middleware,
                        transport: ExecutionTransport.All,
                        global: true,
                        priority: StepPriority.Normal
                    }
                ],
                NormalizedTarget
            );
        });
    });

    describe('injectable registration', () => {
        it.each([
            ['Middleware', Middleware],
            ['Guard', Guard],
            ['Interceptor', Interceptor],
            ['Filter', Filter]
        ])('should register %s as injectable', (_name, decorator) => {
            class TestStep {}

            decorator()(TestStep);

            expect(Constructable).toHaveBeenCalledWith(MetadataKeys.INJECTABLE);
        });
    });

    describe('configuration defaults', () => {
        it('should use ExecutionTransport.All when transport is undefined', () => {
            Metadata.get = jest.fn().mockReturnValue(undefined);
            @Middleware({
                transport: undefined
            })
            class TestMiddleware {}

            expect(Metadata.define).toHaveBeenCalledWith(
                MetadataKeys.STEP_TARGET,
                [
                    {
                        target: TestMiddleware,
                        type: StepType.Middleware,
                        transport: ExecutionTransport.All,
                        global: true,
                        priority: StepPriority.Normal
                    }
                ],
                TestMiddleware
            );
        });

        it('should use false when global is undefined', () => {
            Metadata.get = jest.fn().mockReturnValue(undefined);
            @Guard({
                global: undefined
            })
            class TestGuard {}

            expect(Metadata.define).toHaveBeenCalledWith(
                MetadataKeys.STEP_TARGET,
                [
                    {
                        target: TestGuard,
                        type: StepType.Guard,
                        transport: ExecutionTransport.All,
                        global: true,
                        priority: StepPriority.Normal
                    }
                ],
                TestGuard
            );
        });

        it('should use StepPriority.Normal when priority is undefined', () => {
            Metadata.get = jest.fn().mockReturnValue(undefined);
            @Filter({
                priority: undefined
            })
            class TestFilter {}

            expect(Metadata.define).toHaveBeenCalledWith(
                MetadataKeys.STEP_TARGET,
                [
                    {
                        target: TestFilter,
                        type: StepType.Filter,
                        transport: ExecutionTransport.All,
                        global: true,
                        priority: StepPriority.Normal
                    }
                ],
                TestFilter
            );
        });
    });
});
