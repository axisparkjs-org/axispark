import { ExecutionHandler } from './execution-handler';
import { CatchStepDefinition, AfterStepDefinition, BeforeStepDefinition, CheckStepDefinition, HandleStepDefinition } from '../step';
import { TimeoutDefinition } from '../timeout';
import { CacheDefinition } from '../cache';

/**
 * An interface representing the execution plan of a handler. It includes arrays of step definitions for before, after and catch steps, the handler, as well as an optional timeout definition and an optional cache definition. Plans are cached for the life of the process, so they keep no reference to the execution context or the request objects of the execution that generated them. The execution plan defines the sequence of steps to be executed in response to a request, allowing for structured handling of execution flows, error handling, and timeouts.
 */
export interface ExecutionPlan {
    before: (HandleStepDefinition | CheckStepDefinition | BeforeStepDefinition)[];
    /** The class and the property key of the handler. */
    handler: ExecutionHandler;
    after: AfterStepDefinition[];
    catch: CatchStepDefinition[];
    timeout: TimeoutDefinition | undefined;
    /** The cache of the handler, or `undefined` when its results are not cached. */
    cache: CacheDefinition | undefined;
}
