import { ClassType, Metadata, MetadataKeys } from '@axisparkjs/common';
import { Injectable } from '@axisparkjs/di';
import { validate, ValidationError } from 'class-validator';
import { PipeStep, PipeStepConfig, PipeStepError, PipeStepValidationError } from '../../pipe';
import { ParameterDefinition } from '../../parameter';

/**
 * Options passed through to `class-validator` when validating a parameter.
 */
export interface ValidatorOptions {
    skipMissingProperties?: boolean;
    whitelist?: boolean;
    forbidNonWhitelisted?: boolean;
    groups?: string[];
    dismissDefaultMessages?: boolean;
    validationError?: {
        target?: boolean;
        value?: boolean;
    };
    forbidUnknownValues?: boolean;
    stopAtFirstError?: boolean;
}

export interface ValidateSchemaPipeStepConfig extends PipeStepConfig {
    options?: ValidatorOptions;
}

const NON_SCHEMA_TYPES = new Set<unknown>([Object, Array, String, Number, Boolean, Symbol, BigInt, Function, Promise, Date]);

@Injectable()
export class ValidateSchemaPipeStep implements PipeStep<unknown, object> {
    async execute(parameter: ParameterDefinition, config?: ValidateSchemaPipeStepConfig): Promise<any> {
        const schema = this.resolveSchema(parameter);
        const value = parameter.value;

        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
            throw new PipeStepValidationError(parameter, `Value must be an object matching '${schema.name}'.`);
        }

        const instance = value instanceof schema ? value : Object.assign(Object.create(schema.prototype), value);
        const errors = await validate(instance, config?.options);
        if (errors.length > 0) {
            throw new PipeStepValidationError(parameter, this.formatErrors(errors).join('; '));
        }

        return instance;
    }

    private resolveSchema(parameter: ParameterDefinition): ClassType {
        const { target, propertyKey, parameterIndex } = parameter;
        const types =
            Metadata.get<unknown[]>(MetadataKeys.DESIGN_PARAM_TYPES, target.prototype, propertyKey, false) ??
            Metadata.get<unknown[]>(MetadataKeys.DESIGN_PARAM_TYPES, target, propertyKey, false);
        const type = types?.[parameterIndex];

        if (typeof type !== 'function' || NON_SCHEMA_TYPES.has(type)) {
            throw new PipeStepError(
                parameter,
                `Schema validation for '${parameter.parameter}' in ${target.name}.${String(propertyKey)} requires a class-typed parameter. ` +
                    'Interfaces, generics, union types and primitives are not available at runtime; declare the parameter type as a class.'
            );
        }

        return type as ClassType;
    }

    private formatErrors(errors: ValidationError[], parentPath = ''): string[] {
        return errors.flatMap((error) => {
            const path = [parentPath, error.property].filter(Boolean).join('.');
            const messages = Object.values(error.constraints ?? {}).map((message) => (path ? `${path}: ${message}` : message));
            return [...messages, ...this.formatErrors(error.children ?? [], path)];
        });
    }
}

/**
 * A decorator for applying the `ValidateSchemaPipeStep` to a method parameter. It uses the `Pipe` decorator to define a pipe step that validates the parameter value against the class declared as the parameter type, using the `class-validator` decorators of that class. The class is inferred from the reflected parameter metadata, so it must be a class (interfaces, generics and union types are not supported). If validation fails, a `PipeStepValidationError` is thrown. On success, an instance of the declared class is passed to the next pipe step.
 * @param options The `class-validator` options to use during validation.
 * @returns A pipe decorator that applies the `ValidateSchemaPipeStep`.
 */
export const ValidateSchema = (options?: ValidatorOptions) => {
    return {
        pipeStep: ValidateSchemaPipeStep,
        PipeStepConfig: { options } as ValidateSchemaPipeStepConfig
    };
};
