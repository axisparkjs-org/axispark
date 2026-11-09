import { ExecutionContext } from './execution-context';
import { CatchStepDefinition, AfterStepDefinition, BeforeStepDefinition, CheckStepDefinition, HandleStepDefinition } from '../step';
import { TimeoutDefinition } from '../timeout';
import { CacheDefinition } from '../cache';

/**
 * An interface representing the execution plan for a specific execution context. It includes arrays of step definitions for before, after, catch, and context steps, as well as an optional timeout definition and an optional cache definition. The execution plan defines the sequence of steps to be executed in response to a request, allowing for structured handling of execution flows, error handling, and timeouts.
 */
export interface ExecutionPlan {
    before: (HandleStepDefinition | CheckStepDefinition | BeforeStepDefinition)[];
    context: ExecutionContext;
    after: AfterStepDefinition[];
    catch: CatchStepDefinition[];
    timeout: TimeoutDefinition | undefined;
    /** The cache of the handler, or `undefined` when its results are not cached. */
    cache: CacheDefinition | undefined;
}
