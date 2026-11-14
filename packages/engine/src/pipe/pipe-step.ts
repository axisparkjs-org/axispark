import { Executable } from '@axisparkjs/common';
import { ParameterDefinition } from '../parameter';
import type { ExecutionContext } from '../execution';

export type PipeStepConfig = Record<string, unknown>;

/**
 * A value that a pipe step returns to stop the pipe of its parameter. The rest of the steps are skipped and the handler receives `undefined`. It is returned by `Optional()` when the parameter is missing.
 */
export const PipeStepSkip: unique symbol = Symbol('PipeStepSkip');

export interface PipeStep<I = unknown, O = I> extends Executable {
    execute(parameter: ParameterDefinition, config?: PipeStepConfig, context?: ExecutionContext): O | typeof PipeStepSkip | Promise<O | typeof PipeStepSkip>;
}
