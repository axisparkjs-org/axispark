import { TimeoutGenerator } from '../timeout';
import { CacheDefinition, CacheGenerator } from '../cache';
import { StepDefinition, StepScope, StepType } from '../step';
import { ExecutionContext } from './execution-context';
import { ExecutionTransport } from './execution-transport';
import { ExecutionPlanner } from './execution-planner';
import { StepGenerator } from '../step/step-generator';

describe('ExecutionPlanner', () => {
    let planner: ExecutionPlanner;

    let timeoutGenerator: jest.Mocked<TimeoutGenerator>;
    let stepGenerator: jest.Mocked<StepGenerator>;
    let cacheGenerator: jest.Mocked<CacheGenerator>;

    class Controller {
        execute() {}
    }

    const createContext = (transport = ExecutionTransport.Http): ExecutionContext =>
        ({
            target: Controller,
            propertyKey: 'execute',
            transport
        }) as ExecutionContext;

    const createStep = (
        type: StepType,
        global: boolean,
        transport = ExecutionTransport.All,
        priority = 0,
        extra: Record<string, unknown> = {}
    ): StepDefinition =>
        ({
            type,
            global,
            transport,
            priority,
            target: class {},
            propertyKey: 'execute',
            ...extra
        }) as StepDefinition;

    beforeEach(() => {
        timeoutGenerator = {
            generate: jest.fn()
        } as unknown as jest.Mocked<TimeoutGenerator>;

        stepGenerator = {
            generate: jest.fn()
        } as unknown as jest.Mocked<StepGenerator>;

        cacheGenerator = {
            generate: jest.fn().mockReturnValue(undefined)
        } as unknown as jest.Mocked<CacheGenerator>;

        planner = new ExecutionPlanner(timeoutGenerator, stepGenerator, cacheGenerator);

        timeoutGenerator.generate = jest.fn().mockReturnValue(undefined);
        stepGenerator.generate = jest.fn().mockResolvedValue([]);
    });

    describe('generate', () => {
        it('should generate an empty plan when there are no steps', async () => {
            const context = createContext();

            const result = await planner.plan(context);

            expect(result).toEqual({
                before: [],
                after: [],
                context,
                catch: [],
                timeout: undefined,
                cache: undefined
            });
        });

        it('should use the provided execution context in the plan', async () => {
            const context = createContext();

            const result = await planner.plan(context);

            expect(result.context).toBe(context);
        });

        it('should generate steps using StepGenerator', async () => {
            const context = createContext();

            await planner.plan(context);

            expect(stepGenerator.generate).toHaveBeenCalledTimes(1);
            expect(stepGenerator.generate).toHaveBeenCalledWith(context);
        });

        it('should generate the cache using CacheGenerator', async () => {
            const context = createContext();
            const cache = new CacheDefinition(30_000);
            cacheGenerator.generate.mockReturnValue(cache);

            const result = await planner.plan(context);
            await planner.plan(context);

            expect(result.cache).toBe(cache);
            expect(cacheGenerator.generate).toHaveBeenCalledTimes(1);
            expect(cacheGenerator.generate).toHaveBeenCalledWith(context);
        });

        it('should generate the timeout using TimeoutGenerator', async () => {
            const context = createContext();

            const timeout = {
                time: 5000
            };

            timeoutGenerator.generate.mockReturnValue(timeout as any);

            const result = await planner.plan(context);

            expect(timeoutGenerator.generate).toHaveBeenCalledTimes(1);
            expect(timeoutGenerator.generate).toHaveBeenCalledWith(context);
            expect(result.timeout).toBe(timeout);
        });

        it('should include steps for ExecutionTransport.All', async () => {
            const context = createContext(ExecutionTransport.Http);

            const step = createStep(StepType.Middleware, true, ExecutionTransport.All);

            stepGenerator.generate = jest.fn().mockResolvedValue([step]);

            const result = await planner.plan(context);

            expect(result.before).toEqual([step]);
        });

        it('should include steps for the current transport', async () => {
            const context = createContext(ExecutionTransport.Http);

            const step = createStep(StepType.Middleware, true, ExecutionTransport.Http);

            stepGenerator.generate = jest.fn().mockResolvedValue([step]);

            const result = await planner.plan(context);

            expect(result.before).toEqual([step]);
        });

        it('should ignore steps from another transport', async () => {
            const context = createContext(ExecutionTransport.Http);

            const step = createStep(StepType.Middleware, true, ExecutionTransport.Other);

            stepGenerator.generate = jest.fn().mockResolvedValue([step]);

            const result = await planner.plan(context);

            expect(result.before).toEqual([]);
        });
    });

    describe('before steps', () => {
        it('should put global middlewares before local middlewares', async () => {
            const global = createStep(StepType.Middleware, true, ExecutionTransport.All, 10);

            const local = createStep(StepType.Middleware, false, ExecutionTransport.All, 0);

            stepGenerator.generate = jest.fn().mockResolvedValue([local, global]);

            const result = await planner.plan(createContext());

            expect(result.before).toEqual([global, local]);
        });

        it('should order global middlewares by descending priority', async () => {
            const low = createStep(StepType.Middleware, true, ExecutionTransport.All, 10);

            const high = createStep(StepType.Middleware, true, ExecutionTransport.All, 100);

            const medium = createStep(StepType.Middleware, true, ExecutionTransport.All, 50);

            stepGenerator.generate = jest.fn().mockResolvedValue([low, high, medium]);

            const result = await planner.plan(createContext());

            expect(result.before).toEqual([high, medium, low]);
        });

        it('should order global guards by descending priority', async () => {
            const low = createStep(StepType.Guard, true, ExecutionTransport.All, 1);

            const high = createStep(StepType.Guard, true, ExecutionTransport.All, 100);

            stepGenerator.generate = jest.fn().mockResolvedValue([low, high]);

            const result = await planner.plan(createContext());

            expect(result.before).toEqual([high, low]);
        });

        it('should put guards after middlewares', async () => {
            const middleware = createStep(StepType.Middleware, true, ExecutionTransport.All, 100);

            const guard = createStep(StepType.Guard, true, ExecutionTransport.All, 100);

            stepGenerator.generate = jest.fn().mockResolvedValue([guard, middleware]);

            const result = await planner.plan(createContext());

            expect(result.before).toEqual([middleware, guard]);
        });

        it('should put local guards after global guards', async () => {
            const global = createStep(StepType.Guard, true, ExecutionTransport.All, 100);

            const local = createStep(StepType.Guard, false, ExecutionTransport.All);

            stepGenerator.generate = jest.fn().mockResolvedValue([local, global]);

            const result = await planner.plan(createContext());

            expect(result.before).toEqual([global, local]);
        });

        it('should include only before interceptors in before steps', async () => {
            const before = createStep(StepType.Interceptor, true, ExecutionTransport.All, 10, {
                scope: StepScope.Before
            });

            const after = createStep(StepType.Interceptor, true, ExecutionTransport.All, 20, {
                scope: StepScope.After
            });

            stepGenerator.generate = jest.fn().mockResolvedValue([before, after]);

            const result = await planner.plan(createContext());

            expect(result.before).toEqual([before]);
        });

        it('should order before interceptors after guards', async () => {
            const middleware = createStep(StepType.Middleware, true, ExecutionTransport.All, 100);

            const guard = createStep(StepType.Guard, true, ExecutionTransport.All, 100);

            const interceptor = createStep(StepType.Interceptor, true, ExecutionTransport.All, 100, {
                scope: StepScope.Before
            });

            stepGenerator.generate = jest.fn().mockResolvedValue([interceptor, guard, middleware]);

            const result = await planner.plan(createContext());

            expect(result.before).toEqual([middleware, guard, interceptor]);
        });
    });

    describe('after steps', () => {
        it('should include only after interceptors', async () => {
            const before = createStep(StepType.Interceptor, true, ExecutionTransport.All, 10, {
                scope: StepScope.Before
            });

            const after = createStep(StepType.Interceptor, true, ExecutionTransport.All, 10, {
                scope: StepScope.After
            });

            stepGenerator.generate = jest.fn().mockResolvedValue([before, after]);

            const result = await planner.plan(createContext());

            expect(result.after).toEqual([after]);
        });

        it('should reverse after interceptor order', async () => {
            const first = createStep(StepType.Interceptor, true, ExecutionTransport.All, 100, {
                scope: StepScope.After
            });

            const second = createStep(StepType.Interceptor, true, ExecutionTransport.All, 50, {
                scope: StepScope.After
            });

            stepGenerator.generate = jest.fn().mockResolvedValue([first, second]);

            const result = await planner.plan(createContext());

            expect(result.after).toEqual([second, first]);
        });

        it('should reverse the combined global and local after interceptors', async () => {
            const global = createStep(StepType.Interceptor, true, ExecutionTransport.All, 100, {
                scope: StepScope.After
            });

            const local = createStep(StepType.Interceptor, false, ExecutionTransport.All, 0, {
                scope: StepScope.After
            });

            stepGenerator.generate = jest.fn().mockResolvedValue([global, local]);

            const result = await planner.plan(createContext());

            expect(result.after).toEqual([local, global]);
        });
    });

    describe('catch steps', () => {
        it('should generate catch steps from filters', async () => {
            const filter = createStep(StepType.Filter, true, ExecutionTransport.All, 10);

            stepGenerator.generate = jest.fn().mockResolvedValue([filter]);

            const result = await planner.plan(createContext());

            expect(result.catch).toEqual([filter]);
        });

        it('should ignore non-filter steps', async () => {
            const middleware = createStep(StepType.Middleware, true);

            const guard = createStep(StepType.Guard, true);

            stepGenerator.generate = jest.fn().mockResolvedValue([middleware, guard]);

            const result = await planner.plan(createContext());

            expect(result.catch).toEqual([]);
        });

        it('should generate global and local filters in the expected order', async () => {
            const global1 = createStep(StepType.Filter, true, ExecutionTransport.All, 100);

            const global2 = createStep(StepType.Filter, true, ExecutionTransport.All, 50);

            const local1 = createStep(StepType.Filter, false, ExecutionTransport.All, 0);

            const local2 = createStep(StepType.Filter, false, ExecutionTransport.All, 0);

            stepGenerator.generate = jest.fn().mockResolvedValue([global1, global2, local1, local2]);

            const result = await planner.plan(createContext());

            expect(result.catch).toEqual([local2, local1, global1, global2]);
        });
    });

    describe('plan caching', () => {
        it('should cache the generated plan', async () => {
            const context = createContext();

            await planner.plan(context);
            await planner.plan(context);

            expect(stepGenerator.generate).toHaveBeenCalledTimes(1);
            expect(timeoutGenerator.generate).toHaveBeenCalledTimes(1);
        });

        it('should return the same plan instance from the cache', async () => {
            const context = createContext();

            const first = await planner.plan(context);
            const second = await planner.plan(context);

            expect(second).toBe(first);
        });

        it('should generate different plans for different methods', async () => {
            const firstContext = createContext();

            const secondContext = {
                ...createContext(),
                propertyKey: 'other'
            } as ExecutionContext;

            const firstPlan = await planner.plan(firstContext);
            const secondPlan = await planner.plan(secondContext);

            expect(firstPlan).not.toBe(secondPlan);
            expect(stepGenerator.generate).toHaveBeenCalledTimes(2);
            expect(timeoutGenerator.generate).toHaveBeenCalledTimes(2);
        });

        it('should use the target class and property key as cache key', async () => {
            const firstContext = createContext();

            const secondContext = {
                ...createContext(),
                propertyKey: Symbol('execute')
            } as ExecutionContext;

            await planner.plan(firstContext);
            await planner.plan(secondContext);

            expect(stepGenerator.generate).toHaveBeenCalledTimes(2);
        });

        it('should generate different plans for two classes with the same name', async () => {
            const createController = () => class Controller {};
            const FirstController = createController();
            const SecondController = createController();

            const firstContext = { ...createContext(), target: FirstController } as ExecutionContext;
            const secondContext = { ...createContext(), target: SecondController } as ExecutionContext;

            const firstPlan = await planner.plan(firstContext);
            const secondPlan = await planner.plan(secondContext);

            expect(FirstController.name).toBe(SecondController.name);
            expect(firstPlan).not.toBe(secondPlan);
            expect(firstPlan.context.target).toBe(FirstController);
            expect(secondPlan.context.target).toBe(SecondController);
            await expect(planner.plan(firstContext)).resolves.toBe(firstPlan);
            await expect(planner.plan(secondContext)).resolves.toBe(secondPlan);
        });
    });
});
