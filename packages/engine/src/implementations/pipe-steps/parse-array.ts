import { ClassType } from '@axisparkjs/common';
import { Injectable, Injector } from '@axisparkjs/di';
import { PipeStep, PipeStepConfig, PipeStepParsingError, PipeStepSkip, PipeStepValidationError } from '../../pipe';
import { ParameterDefinition } from '../../parameter';
import type { ExecutionContext } from '../../execution';

/** A pipe step as it is given to `@Pipe()`: a class, or the result of a factory such as `ParseInt()`. */
export type PipeStepReference = ClassType<PipeStep> | { pipeStep: ClassType<PipeStep>; PipeStepConfig: PipeStepConfig };

export interface ParseArrayPipeStepOptions {
    /** The separator of the items of a string. Defaults to `,`. */
    separator?: string;
    /** A step applied to each item, such as `ParseInt()` or `ParseUuid()`. */
    items?: PipeStepReference;
    /** Minimum number of items. */
    minItems?: number;
    /** Maximum number of items. */
    maxItems?: number;
    /** Reject arrays with repeated items, compared after the `items` step. Defaults to `false`. */
    unique?: boolean;
}

export interface ParseArrayPipeStepConfig extends PipeStepConfig, ParseArrayPipeStepOptions {}

@Injectable()
export class ParseArrayPipeStep implements PipeStep<unknown, unknown[]> {
    constructor(private readonly injector: Injector) {}

    async execute(parameter: ParameterDefinition, config?: ParseArrayPipeStepConfig, context?: ExecutionContext): Promise<any> {
        const value = parameter.value;
        if (value === undefined || value === null) {
            throw new PipeStepParsingError(parameter, `Value '${value}' is not a valid array.`, 'array');
        }

        const separator = config?.separator ?? ',';
        const raw = (Array.isArray(value) ? value : [value]).flatMap((item) =>
            typeof item === 'string'
                ? item
                      .split(separator)
                      .map((part) => part.trim())
                      .filter((part) => part !== '')
                : [item]
        );

        const items = config?.items ? await this.parseItems(parameter, raw, config.items, context) : raw;

        if (config?.minItems !== undefined && items.length < config.minItems) {
            throw new PipeStepValidationError(parameter, `Array must have at least ${config.minItems} items.`);
        }
        if (config?.maxItems !== undefined && items.length > config.maxItems) {
            throw new PipeStepValidationError(parameter, `Array must have at most ${config.maxItems} items.`);
        }
        if (config?.unique && new Set(items.map(uniqueKey)).size !== items.length) {
            throw new PipeStepValidationError(parameter, 'Array items must be unique.');
        }

        return items;
    }

    private async parseItems(parameter: ParameterDefinition, raw: unknown[], reference: PipeStepReference, context?: ExecutionContext): Promise<unknown[]> {
        const { pipeStep, pipeStepConfig } =
            typeof reference === 'function'
                ? { pipeStep: reference, pipeStepConfig: undefined }
                : { pipeStep: reference.pipeStep, pipeStepConfig: reference.PipeStepConfig };
        const step = await this.injector.get(pipeStep, context?.scopedContainer);

        const items: unknown[] = [];
        for (const item of raw) {
            const definition = ParameterDefinition.fromMetadata({
                target: parameter.target,
                propertyKey: parameter.propertyKey,
                parameterIndex: parameter.parameterIndex,
                parameter: parameter.parameter,
                field: parameter.field
            });
            definition.setValue(item);
            const parsed = await step.execute(definition, pipeStepConfig, context);
            items.push(parsed === PipeStepSkip ? undefined : parsed);
        }
        return items;
    }
}

function uniqueKey(item: unknown): unknown {
    return item instanceof Date ? `date:${item.getTime()}` : item;
}

/**
 * A decorator for applying the `ParseArrayPipeStep` to a method parameter. It returns an array from a string separated by commas (`?tags=a,b`), a single value (`?tags=a`) or an array (`?tags=a&tags=b`). The items of the strings are trimmed and the empty ones removed. The `items` option applies a step to each item, such as `ParseInt()`. If the parameter is missing, a `PipeStepParsingError` is thrown (use `Default([])` or `Optional()` before it); `minItems`, `maxItems` and `unique` throw a `PipeStepValidationError`.
 *
 * ```typescript
 * list(@Query('ids') @Pipe(Default([]), ParseArray({ items: ParseInt(), maxItems: 50 })) ids: number[]) {}
 * ```
 * @param options Optional settings: `separator`, `items`, `minItems`, `maxItems` and `unique`.
 * @returns A pipe decorator that applies the `ParseArrayPipeStep`.
 */
export const ParseArray = (options?: ParseArrayPipeStepOptions) => {
    return {
        pipeStep: ParseArrayPipeStep,
        PipeStepConfig: { ...options } as ParseArrayPipeStepConfig
    };
};
