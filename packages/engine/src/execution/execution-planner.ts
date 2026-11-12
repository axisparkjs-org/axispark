import { ClassType } from '@axisparkjs/common';
import { ExecutionContext } from './execution-context';
import {
    StepGenerator,
    StepType,
    StepScope,
    AfterStepDefinition,
    BeforeStepDefinition,
    CatchStepDefinition,
    CheckStepDefinition,
    HandleStepDefinition,
    StepDefinition
} from '../step';
import { ExecutionPlan } from './execution-plan';
import { ExecutionTransport } from './execution-transport';
import { Injectable } from '@axisparkjs/di';
import { TimeoutGenerator } from '../timeout';
import { CacheGenerator } from '../cache';

/**
 * A class responsible for generating execution plans based on the provided execution context. It utilizes the `StepGenerator` to generate steps and the `TimeoutGenerator` to generate timeout definitions and the `CacheGenerator` to generate cache definitions. The generated execution plan includes before, after, catch, and context steps, as well as an optional timeout definition and an optional cache definition. The class also caches registered plans for efficient reuse, by the identity of the target class and the property key, so two classes with the same name never share a plan.
 */
@Injectable()
export class ExecutionPlanner {
    private readonly registeredPlans = new Map<ClassType, Map<PropertyKey, ExecutionPlan>>();

    constructor(
        private readonly timeoutGenerator: TimeoutGenerator,
        private readonly stepGenerator: StepGenerator,
        private readonly cacheGenerator: CacheGenerator
    ) {}

    /**
     * Generates an execution plan for the provided execution context.
     * @param context The execution context for which to generate a plan.
     * @returns A promise resolving to the generated execution plan.
     */
    public async plan(context: ExecutionContext): Promise<ExecutionPlan> {
        let plansOfTarget = this.registeredPlans.get(context.target);
        if (!plansOfTarget) {
            plansOfTarget = new Map<PropertyKey, ExecutionPlan>();
            this.registeredPlans.set(context.target, plansOfTarget);
        }

        let plan = plansOfTarget.get(context.propertyKey);
        if (!plan) {
            const steps = await this.stepGenerator.generate(context);
            plan = this.generatePlan(context, steps);
            plansOfTarget.set(context.propertyKey, plan);
        }

        return plan;
    }

    private generatePlan(context: ExecutionContext, steps: StepDefinition[]): ExecutionPlan {
        const validSteps = steps.filter((step) => step.transport === ExecutionTransport.All || step.transport === context.transport);
        const beforeSteps = this.generateBeforeSteps(validSteps);
        const afterSteps = this.generateAfterSteps(validSteps);
        const catchSteps = this.generateCatchSteps(validSteps);
        const timeoutStep = this.timeoutGenerator.generate(context);
        const cache = this.cacheGenerator.generate(context);

        return { before: beforeSteps, after: afterSteps, context, catch: catchSteps, timeout: timeoutStep, cache };
    }

    private getSteps(steps: StepDefinition[], type: StepType, global: boolean) {
        let finalSteps = steps.filter((step) => step.type === type && step.global === global);
        if (global) finalSteps = finalSteps.sort((a, b) => b.priority - a.priority); // Prioridad descendente
        return finalSteps;
    }

    private generateBeforeSteps(steps: StepDefinition[]): (HandleStepDefinition | CheckStepDefinition | BeforeStepDefinition)[] {
        const before: (HandleStepDefinition | CheckStepDefinition | BeforeStepDefinition)[] = [];

        const globalMiddlewares = this.getSteps(steps, StepType.Middleware, true) as HandleStepDefinition[];
        const usingMiddlewares = this.getSteps(steps, StepType.Middleware, false) as HandleStepDefinition[];
        before.push(...globalMiddlewares);
        before.push(...usingMiddlewares);

        const globalGuards = this.getSteps(steps, StepType.Guard, true) as CheckStepDefinition[];
        const usingGuards = this.getSteps(steps, StepType.Guard, false) as CheckStepDefinition[];
        before.push(...globalGuards);
        before.push(...usingGuards);

        const globalInterceptors = this.getSteps(steps, StepType.Interceptor, true) as (BeforeStepDefinition | AfterStepDefinition)[];
        const usingInterceptors = this.getSteps(steps, StepType.Interceptor, false) as (BeforeStepDefinition | AfterStepDefinition)[];
        const interceptors = [...globalInterceptors, ...usingInterceptors].filter((step) => step.scope === StepScope.Before);
        before.push(...interceptors);

        return before;
    }

    private generateAfterSteps(steps: StepDefinition[]): AfterStepDefinition[] {
        const after: AfterStepDefinition[] = [];

        const globalInterceptors = this.getSteps(steps, StepType.Interceptor, true) as (BeforeStepDefinition | AfterStepDefinition)[];
        const usingInterceptors = this.getSteps(steps, StepType.Interceptor, false) as (BeforeStepDefinition | AfterStepDefinition)[];
        const interceptors = [...globalInterceptors, ...usingInterceptors].filter((step) => step.scope === StepScope.After);
        const interceptorsReverse = interceptors.toReversed();
        after.push(...interceptorsReverse);

        return after;
    }

    private generateCatchSteps(steps: StepDefinition[]): CatchStepDefinition[] {
        const catchs: CatchStepDefinition[] = [];

        const globalFilters = this.getSteps(steps, StepType.Filter, true) as CatchStepDefinition[];
        const usingFilters = this.getSteps(steps, StepType.Filter, false) as CatchStepDefinition[];
        const allFilters = [...usingFilters.toReversed(), ...globalFilters];
        catchs.push(...allFilters);

        return catchs;
    }
}
