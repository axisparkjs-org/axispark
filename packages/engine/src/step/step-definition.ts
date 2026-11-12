import { ClassType } from '@axisparkjs/common';
import { ExecutionTransport, ExecutionHandler } from '../execution';
import { StepMethodMetadata, StepTargetMetadata } from '../metadata';

/**
 * An enum representing the different types of steps.
 */
export enum StepType {
    Guard = 'guard',
    Middleware = 'middleware',
    Interceptor = 'interceptor',
    Filter = 'filter'
}

/**
 * An enum representing the different scopes of steps.
 */
export enum StepScope {
    Before = 'before',
    After = 'after'
}

/**
 * An abstract class representing the definition of a step in the execution context.
 */
export abstract class StepDefinition implements ExecutionHandler {
    public constructor(
        public readonly global: boolean,
        public readonly priority: number,
        public readonly transport: ExecutionTransport,
        public readonly target: ClassType,
        public readonly propertyKey: string | symbol,
        public readonly type: StepType
    ) {
        if (!this.global) this.priority = 0;
    }

    /**
     * Creates a step definition from the provided metadata.
     * @param sMM The method metadata for the step.
     * @param sTM The target metadata for the step.
     * @returns A new step definition based on the metadata.
     */
    public static fromMetadata(sMM: StepMethodMetadata, sTM: StepTargetMetadata): StepDefinition {
        switch (sMM.type) {
            case StepType.Middleware:
                return new HandleStepDefinition(sTM.global, sTM.priority, sTM.transport, sMM.target, sMM.propertyKey, sMM.type);
            case StepType.Guard:
                return new CheckStepDefinition(sTM.global, sTM.priority, sTM.transport, sMM.target, sMM.propertyKey, sMM.type);
            case StepType.Interceptor:
                if (sMM.scope === StepScope.Before)
                    return new BeforeStepDefinition(sTM.global, sTM.priority, sTM.transport, sMM.target, sMM.propertyKey, sMM.type, sMM.scope);
                else return new AfterStepDefinition(sTM.global, sTM.priority, sTM.transport, sMM.target, sMM.propertyKey, sMM.type, sMM.scope);
            case StepType.Filter:
                return new CatchStepDefinition(sTM.global, sTM.priority, sTM.transport, sMM.target, sMM.propertyKey, sMM.type, sMM.acceptedErrors);
        }
    }
}
/**
 * A class representing a middleware step definition.
 * It extends the `StepDefinition` class and specifies the step type as `Middleware`.
 */
export class HandleStepDefinition extends StepDefinition {
    declare readonly type: StepType.Middleware;
}
/**
 * A class representing a guard step definition.
 * It extends the `StepDefinition` class and specifies the step type as `Guard`.
 */
export class CheckStepDefinition extends StepDefinition {
    declare readonly type: StepType.Guard;
}
/**
 * A class representing a before interceptor step definition.
 * It extends the `StepDefinition` class and specifies the step type as `Interceptor`.
 */
export class BeforeStepDefinition extends StepDefinition {
    declare readonly type: StepType.Interceptor;

    public constructor(
        global: boolean,
        priority: number,
        transport: ExecutionTransport,
        target: ClassType,
        propertyKey: string | symbol,
        type: StepType.Interceptor,
        public readonly scope: StepScope.Before
    ) {
        super(global, priority, transport, target, propertyKey, type);
    }
}
/**
 * A class representing an after interceptor step definition.
 * It extends the `StepDefinition` class and specifies the step type as `Interceptor`.
 */
export class AfterStepDefinition extends StepDefinition {
    declare readonly type: StepType.Interceptor;

    public constructor(
        global: boolean,
        priority: number,
        transport: ExecutionTransport,
        target: ClassType,
        propertyKey: string | symbol,
        type: StepType.Interceptor,
        public readonly scope: StepScope.After
    ) {
        super(global, priority, transport, target, propertyKey, type);
    }
}
/**
 * A class representing a catch step definition.
 * It extends the `StepDefinition` class and specifies the step type as `Filter`.
 */
export class CatchStepDefinition extends StepDefinition {
    declare readonly type: StepType.Filter;

    public constructor(
        global: boolean,
        priority: number,
        transport: ExecutionTransport,
        target: ClassType,
        propertyKey: string | symbol,
        type: StepType.Filter,
        public readonly acceptedErrors: ClassType<Error>[]
    ) {
        super(global, priority, transport, target, propertyKey, type);
    }
}
