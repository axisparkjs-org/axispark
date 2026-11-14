import { PipeStep, PipeStepConfig } from '../../pipe';
import { Injectable } from '@axisparkjs/di';
import { ParameterDefinition } from '../../parameter';

export interface DefaultPipeStepOptions {
    /** Also use the default value when the parameter is an empty string. Defaults to `false`. */
    emptyString?: boolean;
}

export interface DefaultPipeStepConfig extends PipeStepConfig, DefaultPipeStepOptions {
    value: unknown;
}

@Injectable()
export class DefaultPipeStep implements PipeStep {
    execute(parameter: ParameterDefinition, config: DefaultPipeStepConfig): any {
        const value = parameter.value;
        if (value === undefined || (config.emptyString && value === '')) return copy(config.value);

        return value;
    }
}

// Objects and arrays are copied, so a handler that changes the default value does not change it for the next executions.
function copy(value: unknown): unknown {
    if (value === null || typeof value !== 'object') return value;

    try {
        return structuredClone(value);
    } catch {
        return value;
    }
}

/**
 * A decorator for applying the `DefaultPipeStep` to a method parameter. It returns `value` when the parameter is `undefined` (and also when it is an empty string with `{ emptyString: true }`), so the next steps of the pipe receive the default value. Objects and arrays are copied for each execution. It never fails.
 *
 * ```typescript
 * list(@Query('page') @Pipe(Default(1), ParseInt()) page: number) {}
 * ```
 * @param value The default value of the parameter.
 * @param options Optional settings: `emptyString` also replaces empty strings.
 * @returns A pipe decorator that applies the `DefaultPipeStep` with the specified value.
 */
export const Default = (value: unknown, options?: DefaultPipeStepOptions) => {
    return {
        pipeStep: DefaultPipeStep,
        PipeStepConfig: { value, emptyString: options?.emptyString } as DefaultPipeStepConfig
    };
};
