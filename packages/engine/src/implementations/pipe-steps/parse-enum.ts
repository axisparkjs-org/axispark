import { PipeStep, PipeStepConfig, PipeStepParsingError } from '../../pipe';
import { Injectable } from '@axisparkjs/di';
import { ParameterDefinition } from '../../parameter';

/** A TypeScript enum (string or numeric) or an array of allowed values. */
export type EnumLike = Record<string, string | number> | readonly (string | number)[];

export interface ParseEnumPipeStepOptions {
    /** Compare the strings without case. Defaults to `false`. */
    ignoreCase?: boolean;
}

export interface ParseEnumPipeStepConfig extends PipeStepConfig, ParseEnumPipeStepOptions {
    values: (string | number)[];
}

@Injectable()
export class ParseEnumPipeStep implements PipeStep<unknown, string | number> {
    execute(parameter: ParameterDefinition, config: ParseEnumPipeStepConfig): any {
        const value = parameter.value;
        const normalize = (item: unknown) => (config.ignoreCase ? String(item).toLowerCase() : String(item));

        if (typeof value === 'string' || typeof value === 'number') {
            const exact = config.values.find((allowed) => allowed === value);
            if (exact !== undefined) return exact;

            const match = config.values.find((allowed) => normalize(allowed) === normalize(value));
            if (match !== undefined) return match;
        }

        throw new PipeStepParsingError(parameter, `Value '${value}' is not one of the allowed values: ${config.values.join(', ')}.`, 'enum');
    }
}

/**
 * Returns the values of a TypeScript enum, without the reverse mappings of the numeric enums, or the values of an array.
 * @param enumOrValues The enum or the array of values.
 * @returns The allowed values.
 */
export function enumValues(enumOrValues: EnumLike): (string | number)[] {
    if (Array.isArray(enumOrValues)) return [...enumOrValues];

    const record = enumOrValues as Record<string, string | number>;
    return Object.keys(record)
        .filter((key) => typeof record[record[key]] !== 'number')
        .map((key) => record[key]);
}

/**
 * A decorator for applying the `ParseEnumPipeStep` to a method parameter. It accepts a TypeScript enum (string or numeric) or an array of values, and returns the matching value of the enum: `'1'` is returned as `1` for a numeric enum. With `{ ignoreCase: true }`, the strings are compared without case. If the value is not allowed, a `PipeStepParsingError` listing the allowed values is thrown.
 *
 * ```typescript
 * list(@Query('status') @Pipe(Default(OrderStatus.Open), ParseEnum(OrderStatus)) status: OrderStatus) {}
 * ```
 * @param enumOrValues The enum or the array of allowed values.
 * @param options Optional settings: `ignoreCase` compares the strings without case.
 * @returns A pipe decorator that applies the `ParseEnumPipeStep`.
 */
export const ParseEnum = (enumOrValues: EnumLike, options?: ParseEnumPipeStepOptions) => {
    return {
        pipeStep: ParseEnumPipeStep,
        PipeStepConfig: { values: enumValues(enumOrValues), ignoreCase: options?.ignoreCase } as ParseEnumPipeStepConfig
    };
};
