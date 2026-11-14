import { PipeStep, PipeStepConfig, PipeStepSkip } from '../../pipe';
import { Injectable } from '@axisparkjs/di';
import { ParameterDefinition } from '../../parameter';

export interface OptionalPipeStepOptions {
    /** Also skip the pipe when the parameter is an empty string. Defaults to `false`. */
    emptyString?: boolean;
}

export interface OptionalPipeStepConfig extends PipeStepConfig, OptionalPipeStepOptions {}

@Injectable()
export class OptionalPipeStep implements PipeStep {
    execute(parameter: ParameterDefinition, config?: OptionalPipeStepConfig): any {
        const value = parameter.value;
        if (value === undefined || (config?.emptyString && value === '')) return PipeStepSkip;

        return value;
    }
}

/**
 * A decorator for applying the `OptionalPipeStep` to a method parameter. When the parameter is `undefined` (and also when it is an empty string with `{ emptyString: true }`), the rest of the steps of the pipe are skipped and the handler receives `undefined`. Otherwise, the value continues to the next steps. It never fails.
 *
 * ```typescript
 * list(@Query('from') @Pipe(Optional(), ParseDate()) from: Date | undefined) {}
 * ```
 * @param options Optional settings: `emptyString` also skips empty strings.
 * @returns A pipe decorator that applies the `OptionalPipeStep`.
 */
export const Optional = (options?: OptionalPipeStepOptions) => {
    return {
        pipeStep: OptionalPipeStep,
        PipeStepConfig: { emptyString: options?.emptyString } as OptionalPipeStepConfig
    };
};
