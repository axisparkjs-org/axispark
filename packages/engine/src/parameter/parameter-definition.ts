import { ClassType } from '@axisparkjs/common';
import { ParameterMetadata } from '../metadata';

/**
 * A definition for a method parameter that includes metadata and value handling.
 */
export class ParameterDefinition {
    public originalValue!: any;
    private actualValue!: any;

    private constructor(
        public readonly target: ClassType,
        public readonly propertyKey: string | symbol,
        public readonly parameterIndex: number,
        public readonly parameter: string,
        public readonly field?: string
    ) {}

    static fromMetadata(metadata: ParameterMetadata): ParameterDefinition {
        const parameter = new ParameterDefinition(metadata.target, metadata.propertyKey, metadata.parameterIndex, metadata.parameter, metadata.field);
        return parameter;
    }

    /**
     * Creates a copy of the definition without its value. The definitions generated once per handler are copied for each invocation, because
     * the pipes change the value of the parameter.
     * @returns A new definition with the same metadata and no value.
     */
    clone(): ParameterDefinition {
        return new ParameterDefinition(this.target, this.propertyKey, this.parameterIndex, this.parameter, this.field);
    }

    get value(): any {
        return this.actualValue;
    }

    setValue(value: any): void {
        if (!this.originalValue) this.originalValue = value;
        this.actualValue = value;
    }
}
