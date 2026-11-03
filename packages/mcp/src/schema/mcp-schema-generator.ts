import { ClassType, Metadata, MetadataKeys } from '@axisparkjs/common';
import { Injectable } from '@axisparkjs/di';
import { getMetadataStorage, MetadataStorage, ValidationTypes } from 'class-validator';
import { JsonSchema } from './json-schema';

type ValidationMetadata = ReturnType<MetadataStorage['getTargetValidationMetadatas']>[number];

/**
 * The types that cannot be described by the validation metadata of a class.
 */
const NON_SCHEMA_TYPES = new Set<unknown>([Object, Array, String, Number, Boolean, Symbol, BigInt, Function, Promise, Date]);

type SchemaRule = (schema: JsonSchema, constraints: any[]) => void;

/**
 * The JSON Schema keywords generated for each `class-validator` decorator. Decorators without a rule are validated at runtime but not described in the schema.
 */
const RULES: Record<string, SchemaRule> = {
    isString: (schema) => (schema.type = 'string'),
    isInt: (schema) => (schema.type = 'integer'),
    isNumber: (schema) => (schema.type = 'number'),
    isBoolean: (schema) => (schema.type = 'boolean'),
    isArray: (schema) => (schema.type = 'array'),
    isObject: (schema) => (schema.type = 'object'),
    isNotEmptyObject: (schema) => {
        schema.type = 'object';
        schema.minProperties = 1;
    },
    isDate: (schema) => setStringFormat(schema, 'date-time'),
    isDateString: (schema) => setStringFormat(schema, 'date-time'),
    isIso8601: (schema) => setStringFormat(schema, 'date-time'),
    isEmail: (schema) => setStringFormat(schema, 'email'),
    isUrl: (schema) => setStringFormat(schema, 'uri'),
    isUuid: (schema) => setStringFormat(schema, 'uuid'),
    isNumberString: (schema) => {
        schema.type = 'string';
        schema.pattern = '^-?\\d+(\\.\\d+)?$';
    },
    isBooleanString: (schema) => {
        schema.type = 'string';
        schema.enum = ['true', 'false', '1', '0'];
    },
    isEnum: (schema, [entity]) => (schema.enum = enumValues(entity)),
    isIn: (schema, [values]) => (schema.enum = [...(values ?? [])]),
    equals: (schema, [value]) => (schema.const = value),
    isNotEmpty: (schema) => {
        if (schema.type === 'string') schema.minLength = Math.max(schema.minLength ?? 0, 1);
    },
    minLength: (schema, [min]) => (schema.minLength = min),
    maxLength: (schema, [max]) => (schema.maxLength = max),
    isLength: (schema, [min, max]) => {
        if (typeof min === 'number') schema.minLength = min;
        if (typeof max === 'number') schema.maxLength = max;
    },
    matches: (schema, [pattern]) => (schema.pattern = pattern instanceof RegExp ? pattern.source : String(pattern)),
    min: (schema, [min]) => (schema.minimum = min),
    max: (schema, [max]) => (schema.maximum = max),
    isPositive: (schema) => (schema.exclusiveMinimum = 0),
    isNegative: (schema) => (schema.exclusiveMaximum = 0),
    isDivisibleBy: (schema, [value]) => (schema.multipleOf = value),
    arrayMinSize: (schema, [min]) => (schema.minItems = min),
    arrayMaxSize: (schema, [max]) => (schema.maxItems = max),
    arrayNotEmpty: (schema) => (schema.minItems = Math.max(schema.minItems ?? 0, 1)),
    arrayUnique: (schema) => (schema.uniqueItems = true)
};

function setStringFormat(schema: JsonSchema, format: string): void {
    schema.type = 'string';
    schema.format = format;
}

function enumValues(entity: Record<string, unknown>): unknown[] {
    const values = Object.entries(entity)
        .filter(([key]) => Number.isNaN(Number(key)))
        .map(([, value]) => value);
    return [...new Set(values)];
}

/**
 * A generator of JSON Schemas from the `class-validator` decorators of a class. It is used to publish the input schemas of the MCP tools and the arguments of the MCP prompts.
 */
@Injectable()
export class McpSchemaGenerator {
    /**
     * Checks whether a type can be described with a JSON Schema generated from its validation metadata.
     * @param type The type to check, usually the reflected type of a parameter.
     * @returns True when the type is a class other than the built-in types.
     */
    public isSchemaType(type: unknown): type is ClassType {
        return typeof type === 'function' && !NON_SCHEMA_TYPES.has(type);
    }

    /**
     * Generates the JSON Schema of an object described by a class. Without a class, or for a class without validation metadata, it generates an open object schema.
     * @param type The class decorated with `class-validator` decorators.
     * @returns The JSON Schema of the class.
     */
    public generate(type?: unknown): JsonSchema {
        if (!this.isSchemaType(type)) return { type: 'object' };
        return this.generateObject(type, new Set());
    }

    private generateObject(type: ClassType, visiting: Set<ClassType>): JsonSchema {
        if (visiting.has(type)) return { type: 'object' };
        visiting.add(type);

        const metadatas = getMetadataStorage().getTargetValidationMetadatas(type, '', true, false);
        const byProperty = getMetadataStorage().groupByPropertyName(metadatas);
        const properties: Record<string, JsonSchema> = {};
        const required: string[] = [];

        for (const [propertyName, propertyMetadatas] of Object.entries(byProperty)) {
            if (!propertyName) continue;

            properties[propertyName] = this.generateProperty(type, propertyName, propertyMetadatas, visiting);
            if (this.isRequired(propertyMetadatas)) required.push(propertyName);
        }

        visiting.delete(type);
        const schema: JsonSchema = { type: 'object', properties };
        if (required.length > 0) schema.required = required;
        return schema;
    }

    private generateProperty(type: ClassType, propertyName: string, metadatas: ValidationMetadata[], visiting: Set<ClassType>): JsonSchema {
        const designType = Metadata.get<unknown>(MetadataKeys.DESIGN_TYPE, type.prototype, propertyName, false);
        const schema = this.generateFromDesignType(designType);
        const isArray = schema.type === 'array' || metadatas.some((metadata) => metadata.each);
        if (isArray) schema.type = 'array';

        for (const metadata of metadatas) {
            const target = metadata.each && isArray ? (schema.items ??= {}) : schema;
            if (metadata.type === ValidationTypes.NESTED_VALIDATION) {
                this.applyNested(target, designType, visiting);
                continue;
            }

            const rule = metadata.name ? RULES[metadata.name] : undefined;
            rule?.(target, metadata.constraints ?? []);
        }

        return schema;
    }

    private applyNested(schema: JsonSchema, designType: unknown, visiting: Set<ClassType>): void {
        if (this.isSchemaType(designType)) {
            Object.assign(schema, this.generateObject(designType, visiting));
            return;
        }
        if (schema.type === 'array') {
            schema.items ??= { type: 'object' };
            return;
        }
        schema.type = 'object';
    }

    private generateFromDesignType(designType: unknown): JsonSchema {
        switch (designType) {
            case String:
                return { type: 'string' };
            case Number:
                return { type: 'number' };
            case Boolean:
                return { type: 'boolean' };
            case Array:
                return { type: 'array' };
            case Date:
                return { type: 'string', format: 'date-time' };
            default:
                return {};
        }
    }

    /**
     * A property is required unless it has a conditional validation, such as `@IsOptional()` or `@ValidateIf()`.
     */
    private isRequired(metadatas: ValidationMetadata[]): boolean {
        return !metadatas.some((metadata) => metadata.type === ValidationTypes.CONDITIONAL_VALIDATION);
    }
}
