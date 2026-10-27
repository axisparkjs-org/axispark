import { ClassType } from '@axisparkjs/common';

export interface BaseOpenApiObjectMetadata {
    description?: string;
    required?: boolean;
    nullable?: boolean;
}

export interface StringApiObjectMetadata extends BaseOpenApiObjectMetadata {
    type: 'string';
    example?: string;
    default?: string;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    format?: string;
    enum?: string[];
}

export interface NumberApiObjectMetadata extends BaseOpenApiObjectMetadata {
    type: 'number' | 'integer';
    example?: number;
    default?: number;
    minimum?: number;
    exclusiveMinimum?: boolean;
    maximum?: number;
    exclusiveMaximum?: boolean;
}

export interface BooleanApiObjectMetadata extends BaseOpenApiObjectMetadata {
    type: 'boolean';
    example?: boolean;
    default?: boolean;
}

export interface ClassApiObjectMetadata extends BaseOpenApiObjectMetadata {
    type: ClassType;
    example?: object;
}

export interface ArrayApiObjectMetadata extends BaseOpenApiObjectMetadata {
    type: 'array';
    items: OpenApiObjectMetadata[];
    example?: any[];
    default?: any[];
    minItems?: number;
    maxItems?: number;
    uniqueItems?: boolean;
}

export type OpenApiObjectMetadata =
    StringApiObjectMetadata | NumberApiObjectMetadata | BooleanApiObjectMetadata | ClassApiObjectMetadata | ArrayApiObjectMetadata;
