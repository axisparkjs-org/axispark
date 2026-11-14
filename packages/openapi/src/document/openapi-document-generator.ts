import { Generator, Metadata, MetadataKeys, ClassType } from '@axisparkjs/common';
import { OpenApiDocumentDefinition } from './openapi-document-definition';
import { OpenApiPluginOptions } from '../plugin/openapi-plugin-options';
import { RouteDefinition } from '@axisparkjs/http';
import { OpenApiResponseMetadata } from '../metadata/openapi-response-metadata';
import { OpenApiSchemaMetadata } from '../metadata/openapi-schema-metadata';
import { OpenApiPropertyMetadata } from '../metadata/openapi-property-metadata';
import { Inject, Injectable } from '@axisparkjs/di';
import { OPENAPI_OPTIONS } from '../di';
import { ParameterGenerator } from '@axisparkjs/engine';

/**
 * A generator for creating OpenAPI document definitions based on route definitions and metadata.
 */
@Injectable()
export class OpenApiDocumentGenerator implements Generator<OpenApiDocumentDefinition> {
    private readonly schemasToGenerate = new Set<ClassType>();
    private readonly shcemasAlreadyGenerated = new Set<ClassType>();
    private routes: RouteDefinition[];
    private readonly responsesByRoute = new Map<RouteDefinition, any>();
    private components: any;

    constructor(
        @Inject(OPENAPI_OPTIONS) private readonly options: OpenApiPluginOptions,
        private readonly parameterGenerator: ParameterGenerator
    ) {}

    /**
     * Generates an OpenAPI document definition based on the provided route definitions.
     * @param routes An array of route definitions for which to generate OpenAPI documentation.
     * @returns An `OpenApiDocumentDefinition` instance representing the generated OpenAPI document.
     */
    generate(routes: readonly RouteDefinition[]): OpenApiDocumentDefinition {
        this.routes = [...routes];
        const data: object = {
            openapi: '3.1.0',
            info: {
                title: this.options.info.title,
                version: this.options.info.version,
                description: this.options.info.description,
                termsOfService: this.options.info.termsOfService,
                contact: this.options.info.contact,
                license: this.options.info.license,
                summary: this.options.info.summary
            },
            externalDocs: this.options.info.externalDocs,
            tags: this.options.info.tags,
            servers: this.options.info.servers,
            webhooks: undefined,
            security: [],
            paths: this.generatePaths(),
            components: {
                schemas: this.generateSchemas()
            }
        };
        this.components = (data as { components: unknown }).components;
        return new OpenApiDocumentDefinition(data);
    }

    /**
     * Returns the JSON schemas of the `application/json` responses of a route of the last generated document, by status code. Each schema is
     * self-contained: it includes the `components` of the document, so its `#/components/schemas/...` references can be resolved.
     * @param route A route of the last call to `generate()`.
     * @returns The schemas by status code, or `undefined` when the route has no documented JSON response.
     */
    generateResponseSchemas(route: RouteDefinition): Record<string, object> | undefined {
        const responses = this.responsesByRoute.get(route);
        if (!responses) return undefined;

        // The undefined values of the generated objects are removed, as in the JSON document.
        const components = JSON.parse(JSON.stringify(this.components ?? {}));
        const schemas: Record<string, object> = {};
        for (const [status, response] of Object.entries<any>(responses)) {
            const schema = response?.content?.['application/json']?.schema;
            if (schema) schemas[status] = { ...JSON.parse(JSON.stringify(schema)), components };
        }
        return Object.keys(schemas).length > 0 ? schemas : undefined;
    }

    private generateSchemas(): any {
        let schemas = {};
        do {
            const filteredSchemas = Array.from(this.schemasToGenerate).filter((schema) => !this.shcemasAlreadyGenerated.has(schema));
            this.schemasToGenerate.clear();
            filteredSchemas.forEach((schema) => this.shcemasAlreadyGenerated.add(schema));

            const result = filteredSchemas.reduce((acc, schema) => {
                acc[this.generateNameForSchema(schema)] = this.generateSchema(schema);
                return acc;
            }, {} as any);
            schemas = { ...schemas, ...result };
        } while (this.schemasToGenerate.size > 0);

        return schemas;
    }

    private generateSchema(schema: ClassType): any {
        const openApiSchemaMetadata = Metadata.get<OpenApiSchemaMetadata>(MetadataKeys.OPENAPI_SCHEMA, schema);
        const openApiPropertyMetadata = Metadata.get<OpenApiPropertyMetadata[]>(MetadataKeys.OPENAPI_PROPERTY, schema) || [];
        const exampleKey = openApiSchemaMetadata?.example instanceof Array ? 'examples' : 'example';
        const requiredProperties = openApiPropertyMetadata
            .filter((property) => property.required)
            .map((property) => property.name || property.propertyKey.toString());

        return {
            type: 'object',
            description: openApiSchemaMetadata?.description,
            [exampleKey]: openApiSchemaMetadata?.example,
            properties: this.generateProperties(schema),
            required: requiredProperties.length > 0 ? requiredProperties : undefined
        };
    }

    private generateProperties(schema: ClassType): any {
        const openApiPropertiesMetadata = Metadata.get<OpenApiPropertyMetadata[]>(MetadataKeys.OPENAPI_PROPERTY, schema) || [];
        if (openApiPropertiesMetadata.length === 0) return undefined;
        return openApiPropertiesMetadata.reduce((acc, metadata) => {
            const name = metadata.name || metadata.propertyKey.toString();
            metadata.name = undefined;
            acc[name] = this.generateOpenApiObjectFromMetadata(metadata);
            return acc;
        }, {} as any);
    }

    private generatePaths() {
        return this.routes.reduce((acc, route) => {
            const { path, httpMethod, target, propertyKey } = route;
            const openApiPath = this.transformPathToOpenApiFormat(path);

            if (!acc[openApiPath]) acc[openApiPath] = {};

            const responses = this.isSpecialCaseRoute(route) ? this.generateSpecialCaseResponses(route) : this.generateResponses(route);
            if (responses) this.responsesByRoute.set(route, responses);
            acc[openApiPath][httpMethod] = {
                operationId: this.generateOperationId(target, propertyKey),
                responses,
                parameters: this.generateParameters(route),
                requestBody: this.generateRequestBody(route),
                summary: `${httpMethod.toUpperCase()} ${openApiPath} ${target.name}.${propertyKey.toString()}`
            };

            return acc;
        }, {} as any);
    }

    private generateParameters(route: RouteDefinition) {
        const allowedParameterTypes = ['path', 'header', 'query', 'cookie'];
        let parameters = this.parameterGenerator.generate(undefined, route, false);
        parameters = parameters.filter((parameter) => allowedParameterTypes.includes(parameter.parameter));
        if (parameters.length === 0) return undefined;

        return parameters.map((parameter) => {
            const { parameter: type, propertyKey, field, target, parameterIndex } = parameter;
            const typeMeta = OpenApiDocumentGenerator.extractTypeFromMetadata(target, propertyKey, parameterIndex);
            return {
                name: field ?? propertyKey.toString(),
                in: type,
                schema: {
                    type: typeMeta
                },
                required: type === 'path' ? true : undefined
            };
        });
    }

    private generateRequestBody(route: RouteDefinition) {
        const allowedParameterTypes = ['body'];
        let parameters = this.parameterGenerator.generate(undefined, route, false);
        parameters = parameters.filter((parameter) => allowedParameterTypes.includes(parameter.parameter));
        if (parameters.length === 0) return undefined;
        const param = parameters[0];

        const typeMeta = OpenApiDocumentGenerator.extractTypeFromMetadata(param.target, param.propertyKey, param.parameterIndex);
        if (this.isPrimitiveType(typeMeta)) return;

        return {
            content: {
                'application/json': {
                    schema: {
                        $ref: this.generateReferenceForSchema(typeMeta as ClassType)
                    }
                }
            }
        };
    }

    private isPrimitiveType(type: any): boolean {
        return type === 'string' || type === 'number' || type === 'boolean' || type === 'array';
    }

    private isSpecialCaseRoute(route: RouteDefinition): boolean {
        return route.target.name === 'OpenApiController';
    }

    private generateSpecialCaseResponses(route: RouteDefinition) {
        const regex = /getOpenApi(Json)?(Yaml)?/;
        const match = route.propertyKey.toString().match(regex);
        const format = match ? (match[1] ?? match[2]) : '';
        const isJson = format === 'Json';

        return {
            200: {
                description: `Returns the OpenAPI document in ${format.toUpperCase()} format`,
                content: {
                    [isJson ? 'application/json' : 'text/yaml']: {
                        schema: {
                            type: isJson ? 'object' : 'string'
                        }
                    }
                }
            }
        };
    }

    private generateResponses(route: RouteDefinition) {
        const openApiResponseMetadata = Metadata.get<OpenApiResponseMetadata[]>(MetadataKeys.OPENAPI_RESPONSE, route.target, route.propertyKey) ?? [];
        if (openApiResponseMetadata.length === 0) return undefined;

        return openApiResponseMetadata.reduce((acc, metadata) => {
            acc[metadata.statusCode] = {
                description: metadata.description,
                content: metadata.type
                    ? {
                          'application/json': {
                              schema: this.generateOpenApiObjectFromMetadata(metadata)
                          }
                      }
                    : undefined
            };
            return acc;
        }, {} as any);
    }

    private generateOpenApiObjectFromMetadata(metadata: OpenApiPropertyMetadata | OpenApiResponseMetadata): any {
        const isPrimitive = this.isPrimitiveType(metadata.type);
        const schemaData = !isPrimitive
            ? {
                  $ref: this.generateReferenceForSchema(metadata.type as ClassType)
              }
            : undefined;

        const isArray = metadata.type === 'array';
        const arrayData = isArray
            ? {
                  type: 'array',
                  items:
                      metadata.items.length > 0
                          ? metadata.items.length === 1
                              ? {
                                    type: this.isPrimitiveType(metadata.items[0].type) ? metadata.items[0].type : undefined,
                                    $ref: !this.isPrimitiveType(metadata.items[0].type)
                                        ? this.generateReferenceForSchema(metadata.items[0].type as ClassType)
                                        : undefined
                                }
                              : {
                                    oneOf: metadata.items.map((item) => {
                                        const isPrimitive = this.isPrimitiveType(item.type);
                                        return {
                                            type: isPrimitive ? item.type : undefined,
                                            $ref: !isPrimitive ? this.generateReferenceForSchema(item.type as ClassType) : undefined
                                        };
                                    })
                                }
                          : undefined,
                  example: metadata.example,
                  default: metadata.default,
                  minItems: metadata.minItems,
                  maxItems: metadata.maxItems,
                  uniqueItems: metadata.uniqueItems
              }
            : undefined;

        const basicData =
            isPrimitive && !isArray
                ? (() => {
                      const { target, propertyKey, ...rest } = metadata;
                      return rest;
                  })()
                : undefined;

        return {
            ...schemaData,
            ...arrayData,
            ...basicData
        };
    }

    private transformPathToOpenApiFormat(path: string): string {
        return path.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
    }

    public static extractTypeFromMetadata(
        target: ClassType,
        propertyKey: string | symbol,
        parameterIndex?: number
    ): 'string' | 'number' | 'array' | 'boolean' | ClassType {
        const methodType = Metadata.get<typeof Object | typeof Array | typeof String | typeof Number | typeof Boolean | typeof Date>(
            MetadataKeys.DESIGN_TYPE,
            target.prototype,
            propertyKey,
            false
        );
        const parameterTypes =
            Metadata.get<(typeof Object | typeof Array | typeof String | typeof Number | typeof Boolean | typeof Date)[]>(
                MetadataKeys.DESIGN_PARAM_TYPES,
                target.prototype,
                propertyKey,
                false
            ) || [];

        const type = parameterIndex !== undefined ? parameterTypes[parameterIndex] : methodType;
        switch (type) {
            case Array:
                return 'array';
            case Date:
            case String:
                return 'string';
            case Number:
                return 'number';
            case Boolean:
                return 'boolean';
            default:
            case Object:
                return type as ClassType;
        }
    }

    private generateOperationId(target: ClassType, propertyKey: string | symbol): string {
        return `${target.name.toLocaleLowerCase().replace(/controller/i, '')}-${propertyKey.toString().toLocaleLowerCase()}`;
    }

    private generateReferenceForSchema(schema: ClassType): string {
        this.schemasToGenerate.add(schema);
        return `#/components/schemas/${this.generateNameForSchema(schema)}`;
    }

    private generateNameForSchema(schema: ClassType): string {
        const openApiSchemaMetadata = Metadata.get<OpenApiSchemaMetadata>(MetadataKeys.OPENAPI_SCHEMA, schema) as OpenApiSchemaMetadata;
        return openApiSchemaMetadata?.name ?? schema.name;
    }
}
