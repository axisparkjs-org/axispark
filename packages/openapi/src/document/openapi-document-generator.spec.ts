import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { OpenApiDocumentDefinition } from './openapi-document-definition';
import { OpenApiDocumentGenerator } from './openapi-document-generator';
import { OpenApiPluginOptions } from '../plugin/openapi-plugin-options';
import { MetadataKey } from '@axisparkjs/common';

jest.mock('@axisparkjs/common', () => ({
    Metadata: {
        get: jest.fn(),
        normalizeTarget: jest.fn(),
        define: jest.fn()
    },
    MetadataKeys: {
        OPENAPI_SCHEMA: 'OPENAPI_SCHEMA',
        OPENAPI_PROPERTY: 'OPENAPI_PROPERTY',
        OPENAPI_RESPONSE: 'OPENAPI_RESPONSE',
        PARAMETER: 'PARAMETER',
        DESIGN_TYPE: 'DESIGN_TYPE',
        DESIGN_PARAM_TYPES: 'DESIGN_PARAM_TYPES'
    }
}));

jest.mock('./openapi-document-definition');

describe('OpenApiDocumentGenerator', () => {
    const options: OpenApiPluginOptions = {
        info: {
            title: 'Test API',
            version: '1.0.0'
        }
    } as OpenApiPluginOptions;

    let generator: OpenApiDocumentGenerator;
    let parameterGenerator: { generate: jest.Mock };

    beforeEach(() => {
        jest.clearAllMocks();

        parameterGenerator = { generate: jest.fn().mockReturnValue([]) };
        generator = new OpenApiDocumentGenerator(options, parameterGenerator as any);

        (Metadata.get as jest.Mock).mockReturnValue(undefined);
    });

    describe('generate', () => {
        it('should generate an OpenAPI 3.1 document', () => {
            const routes: any = [];

            const result = generator.generate(routes);

            expect(OpenApiDocumentDefinition).toHaveBeenCalledWith({
                openapi: '3.1.0',
                info: {
                    title: 'Test API',
                    version: '1.0.0',
                    description: undefined,
                    termsOfService: undefined,
                    contact: undefined,
                    license: undefined,
                    summary: undefined
                },
                externalDocs: undefined,
                tags: undefined,
                servers: undefined,
                webhooks: undefined,
                security: [],
                paths: {},
                components: {
                    schemas: {}
                }
            });

            expect(result).toBeInstanceOf(OpenApiDocumentDefinition);
        });

        it('should include all configured info properties', () => {
            const fullOptions = {
                info: {
                    title: 'My API',
                    version: '2.0.0',
                    description: 'API description',
                    termsOfService: 'https://example.com/terms',
                    contact: {
                        name: 'Support',
                        email: 'support@example.com'
                    },
                    license: {
                        name: 'MIT'
                    },
                    summary: 'API summary',
                    externalDocs: {
                        url: 'https://example.com/docs'
                    },
                    tags: [
                        {
                            name: 'users'
                        }
                    ],
                    servers: [
                        {
                            url: 'https://api.example.com'
                        }
                    ]
                }
            } as OpenApiPluginOptions;

            const instance = new OpenApiDocumentGenerator(fullOptions, parameterGenerator as any);

            instance.generate([]);

            expect(OpenApiDocumentDefinition).toHaveBeenCalledWith(
                expect.objectContaining({
                    info: {
                        title: 'My API',
                        version: '2.0.0',
                        description: 'API description',
                        termsOfService: 'https://example.com/terms',
                        contact: {
                            name: 'Support',
                            email: 'support@example.com'
                        },
                        license: {
                            name: 'MIT'
                        },
                        summary: 'API summary'
                    },
                    externalDocs: fullOptions.info.externalDocs,
                    tags: fullOptions.info.tags,
                    servers: fullOptions.info.servers
                })
            );
        });
    });

    describe('generatePaths', () => {
        it('should transform route parameters into OpenAPI path parameters', () => {
            class UsersController {
                getUser() {}
            }

            const route = {
                path: '/users/:id',
                httpMethod: 'get',
                target: UsersController,
                propertyKey: 'getUser'
            } as any;

            parameterGenerator.generate.mockReturnValue([]);

            generator.generate([route]);

            expect(OpenApiDocumentDefinition).toHaveBeenCalledWith(
                expect.objectContaining({
                    paths: {
                        '/users/{id}': {
                            get: expect.objectContaining({
                                operationId: 'users-getuser',
                                summary: 'GET /users/{id} UsersController.getUser'
                            })
                        }
                    }
                })
            );
        });

        it('should group multiple methods under the same path', () => {
            class UsersController {
                getUsers() {}
                createUser() {}
            }

            const routes = [
                {
                    path: '/users',
                    httpMethod: 'get',
                    target: UsersController,
                    propertyKey: 'getUsers'
                },
                {
                    path: '/users',
                    httpMethod: 'post',
                    target: UsersController,
                    propertyKey: 'createUser'
                }
            ] as any[];

            generator.generate(routes);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.paths['/users'].get).toBeDefined();
            expect(definition.paths['/users'].post).toBeDefined();
        });
    });

    describe('generateSchemas', () => {
        class User {}

        it('should generate an empty schemas object when there are no schemas', () => {
            generator.generate([]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.components.schemas).toEqual({});
        });

        it('should generate a schema referenced by a request body', () => {
            class CreateUserDto {}

            const route = {
                path: '/users',
                httpMethod: 'post',
                target: class UsersController {
                    create() {}
                },
                propertyKey: 'create'
            } as any;

            (Metadata.get as jest.Mock).mockImplementation((key: MetadataKey, target?: any) => {
                parameterGenerator.generate.mockReturnValue([
                    {
                        parameter: 'body',
                        propertyKey: 'body',
                        target: route.target,
                        parameterIndex: 0
                    }
                ]);

                if (key === MetadataKeys.DESIGN_PARAM_TYPES) {
                    return [CreateUserDto];
                }

                if (key === MetadataKeys.OPENAPI_SCHEMA && target === CreateUserDto) {
                    return {
                        name: 'CreateUser',
                        description: 'Create user payload'
                    };
                }

                if (key === MetadataKeys.OPENAPI_PROPERTY && target === CreateUserDto) {
                    return [
                        {
                            propertyKey: 'name',
                            type: 'string',
                            required: true
                        }
                    ];
                }

                return undefined;
            });

            generator.generate([route]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.components.schemas).toEqual({
                CreateUser: {
                    type: 'object',
                    description: 'Create user payload',
                    example: undefined,
                    properties: {
                        name: {
                            type: 'string',
                            required: true
                        }
                    },
                    required: ['name']
                }
            });
        });

        it('should use the class name when schema metadata has no name', () => {
            (Metadata.get as jest.Mock).mockImplementation((key: MetadataKey, target?: any) => {
                if (key === MetadataKeys.OPENAPI_SCHEMA) {
                    return undefined;
                }

                if (key === MetadataKeys.OPENAPI_PROPERTY && target === User) {
                    return [];
                }

                return undefined;
            });

            const route = {
                path: '/users',
                httpMethod: 'post',
                target: class UsersController {
                    create() {}
                },
                propertyKey: 'create'
            } as any;

            (Metadata.get as jest.Mock).mockImplementation((key: MetadataKey, target?: any) => {
                parameterGenerator.generate.mockReturnValue([
                    {
                        parameter: 'body',
                        propertyKey: 'body',
                        target: route.target,
                        parameterIndex: 0
                    }
                ]);

                if (key === MetadataKeys.DESIGN_PARAM_TYPES) {
                    return [User];
                }

                if (key === MetadataKeys.OPENAPI_PROPERTY && target === User) {
                    return undefined;
                }

                return undefined;
            });

            generator.generate([route]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.components.schemas.User).toBeDefined();
        });

        it('should use the schema metadata name when provided', () => {
            class Product {}

            const route = {
                path: '/products',
                httpMethod: 'post',
                target: class ProductsController {
                    create() {}
                },
                propertyKey: 'create'
            } as any;

            (Metadata.get as jest.Mock).mockImplementation((key: MetadataKey, target?: any) => {
                parameterGenerator.generate.mockReturnValue([
                    {
                        parameter: 'body',
                        propertyKey: 'body',
                        target: route.target,
                        parameterIndex: 0
                    }
                ]);

                if (key === MetadataKeys.DESIGN_PARAM_TYPES) {
                    return [Product];
                }

                if (key === MetadataKeys.OPENAPI_SCHEMA && target === Product) {
                    return {
                        name: 'ProductPayload'
                    };
                }

                if (key === MetadataKeys.OPENAPI_PROPERTY && target === Product) {
                    return [];
                }

                return undefined;
            });

            generator.generate([route]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.components.schemas).toEqual({
                ProductPayload: {
                    type: 'object',
                    description: undefined,
                    example: undefined,
                    properties: undefined,
                    required: undefined
                }
            });
        });

        it('should generate required properties', () => {
            class User {}

            const route = {
                path: '/users',
                httpMethod: 'post',
                target: class UsersController {
                    create() {}
                },
                propertyKey: 'create'
            } as any;

            (Metadata.get as jest.Mock).mockImplementation((key: MetadataKey, target?: any) => {
                parameterGenerator.generate.mockReturnValue([
                    {
                        parameter: 'body',
                        propertyKey: 'body',
                        target: route.target,
                        parameterIndex: 0
                    }
                ]);

                if (key === MetadataKeys.DESIGN_PARAM_TYPES) {
                    return [User];
                }

                if (key === MetadataKeys.OPENAPI_PROPERTY && target === User) {
                    return [
                        {
                            propertyKey: 'id',
                            type: 'number',
                            required: true
                        },
                        {
                            propertyKey: 'name',
                            type: 'string',
                            required: false
                        },
                        {
                            propertyKey: 'email',
                            type: 'string',
                            required: true
                        }
                    ];
                }

                return undefined;
            });

            generator.generate([route]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.components.schemas.User.required).toEqual(['id', 'email']);
        });

        it('should use property name instead of propertyKey when provided', () => {
            class User {}

            const route = {
                path: '/users',
                httpMethod: 'post',
                target: class UsersController {
                    create() {}
                },
                propertyKey: 'create'
            } as any;

            (Metadata.get as jest.Mock).mockImplementation((key: MetadataKey, target?: any) => {
                parameterGenerator.generate.mockReturnValue([
                    {
                        parameter: 'body',
                        propertyKey: 'body',
                        target: route.target,
                        parameterIndex: 0
                    }
                ]);

                if (key === MetadataKeys.DESIGN_PARAM_TYPES) {
                    return [User];
                }

                if (key === MetadataKeys.OPENAPI_PROPERTY && target === User) {
                    return [
                        {
                            propertyKey: 'firstName',
                            name: 'first_name',
                            type: 'string',
                            required: true
                        }
                    ];
                }

                return undefined;
            });

            generator.generate([route]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.components.schemas.User.required).toEqual(['first_name']);

            expect(definition.components.schemas.User.properties).toEqual({
                first_name: {
                    type: 'string',
                    required: true
                }
            });
        });

        it('should generate example when example is not an array', () => {
            class User {}

            const route = {
                path: '/users',
                httpMethod: 'post',
                target: class UsersController {
                    create() {}
                },
                propertyKey: 'create'
            } as any;

            const example = {
                id: 1,
                name: 'John'
            };

            (Metadata.get as jest.Mock).mockImplementation((key: MetadataKey, target?: any) => {
                parameterGenerator.generate.mockReturnValue([
                    {
                        parameter: 'body',
                        propertyKey: 'body',
                        target: route.target,
                        parameterIndex: 0
                    }
                ]);

                if (key === MetadataKeys.DESIGN_PARAM_TYPES) {
                    return [User];
                }

                if (key === MetadataKeys.OPENAPI_SCHEMA && target === User) {
                    return {
                        example
                    };
                }

                if (key === MetadataKeys.OPENAPI_PROPERTY && target === User) {
                    return [];
                }

                return undefined;
            });

            generator.generate([route]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.components.schemas.User.example).toEqual(example);
            expect(definition.components.schemas.User.examples).toBeUndefined();
        });

        it('should generate examples when example is an array', () => {
            class User {}

            const route = {
                path: '/users',
                httpMethod: 'post',
                target: class UsersController {
                    create() {}
                },
                propertyKey: 'create'
            } as any;

            const examples = [{ id: 1 }, { id: 2 }];

            (Metadata.get as jest.Mock).mockImplementation((key: MetadataKey, target?: any) => {
                parameterGenerator.generate.mockReturnValue([
                    {
                        parameter: 'body',
                        propertyKey: 'body',
                        target: route.target,
                        parameterIndex: 0
                    }
                ]);

                if (key === MetadataKeys.DESIGN_PARAM_TYPES) {
                    return [User];
                }

                if (key === MetadataKeys.OPENAPI_SCHEMA && target === User) {
                    return {
                        example: examples
                    };
                }

                if (key === MetadataKeys.OPENAPI_PROPERTY && target === User) {
                    return [];
                }

                return undefined;
            });

            generator.generate([route]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.components.schemas.User.examples).toEqual(examples);
            expect(definition.components.schemas.User.example).toBeUndefined();
        });
    });

    describe('generateRequestBody', () => {
        class TestController {
            test() {}
        }

        it('should return undefined when there is no body parameter', () => {
            const route = {
                path: '/test',
                httpMethod: 'post',
                target: TestController,
                propertyKey: 'test'
            } as any;

            (Metadata.get as jest.Mock).mockImplementation((_key: MetadataKey) => {
                parameterGenerator.generate.mockReturnValue([]);

                return undefined;
            });

            generator.generate([route]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.paths['/test'].post.requestBody).toBeUndefined();
        });

        it('should return undefined when body is primitive', () => {
            const route = {
                path: '/test',
                httpMethod: 'post',
                target: TestController,
                propertyKey: 'test'
            } as any;

            (Metadata.get as jest.Mock).mockImplementation((key: MetadataKey) => {
                parameterGenerator.generate.mockReturnValue([
                    {
                        parameter: 'body',
                        propertyKey: 'body',
                        target: TestController,
                        parameterIndex: 0
                    }
                ]);

                if (key === MetadataKeys.DESIGN_PARAM_TYPES) {
                    return [String];
                }

                return undefined;
            });

            generator.generate([route]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.paths['/test'].post.requestBody).toBeUndefined();
        });

        it.each([String, Number, Boolean, Array])('should not generate requestBody for primitive %p', (type) => {
            const route = {
                path: '/test',
                httpMethod: 'post',
                target: TestController,
                propertyKey: 'test'
            } as any;

            (Metadata.get as jest.Mock).mockImplementation((key: MetadataKey) => {
                parameterGenerator.generate.mockReturnValue([
                    {
                        parameter: 'body',
                        propertyKey: 'body',
                        target: TestController,
                        parameterIndex: 0
                    }
                ]);

                if (key === MetadataKeys.DESIGN_PARAM_TYPES) {
                    return [type];
                }

                return undefined;
            });

            generator.generate([route]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.paths['/test'].post.requestBody).toBeUndefined();
        });

        it('should generate a requestBody reference for a class', () => {
            class CreateUserDto {}

            const route = {
                path: '/users',
                httpMethod: 'post',
                target: TestController,
                propertyKey: 'test'
            } as any;

            (Metadata.get as jest.Mock).mockImplementation((key: MetadataKey) => {
                parameterGenerator.generate.mockReturnValue([
                    {
                        parameter: 'body',
                        propertyKey: 'body',
                        target: TestController,
                        parameterIndex: 0
                    }
                ]);

                if (key === MetadataKeys.DESIGN_PARAM_TYPES) {
                    return [CreateUserDto];
                }

                if (key === MetadataKeys.OPENAPI_PROPERTY) {
                    return [];
                }

                return undefined;
            });

            generator.generate([route]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.paths['/users'].post.requestBody).toEqual({
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/CreateUserDto'
                        }
                    }
                }
            });

            expect(definition.components.schemas.CreateUserDto).toBeDefined();
        });

        it('should only use the first body parameter', () => {
            class FirstBody {}
            class SecondBody {}

            const route = {
                path: '/test',
                httpMethod: 'post',
                target: TestController,
                propertyKey: 'test'
            } as any;

            (Metadata.get as jest.Mock).mockImplementation((key: MetadataKey) => {
                parameterGenerator.generate.mockReturnValue([
                    {
                        parameter: 'body',
                        propertyKey: 'first',
                        target: TestController,
                        parameterIndex: 0
                    },
                    {
                        parameter: 'body',
                        propertyKey: 'second',
                        target: TestController,
                        parameterIndex: 1
                    }
                ]);

                if (key === MetadataKeys.DESIGN_PARAM_TYPES) {
                    return [FirstBody, SecondBody];
                }

                if (key === MetadataKeys.OPENAPI_PROPERTY) {
                    return [];
                }

                return undefined;
            });

            generator.generate([route]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.paths['/test'].post.requestBody.content['application/json'].schema.$ref).toBe('#/components/schemas/FirstBody');

            expect(definition.components.schemas.FirstBody).toBeDefined();
            expect(definition.components.schemas.SecondBody).toBeUndefined();
        });
    });

    describe('generateResponses', () => {
        class TestController {
            test() {}
        }

        it('should return undefined when there is no response metadata', () => {
            const route = {
                path: '/test',
                httpMethod: 'get',
                target: TestController,
                propertyKey: 'test'
            } as any;

            (Metadata.get as jest.Mock).mockReturnValue(undefined);

            generator.generate([route]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.paths['/test'].get.responses).toBeUndefined();
        });

        it('should generate a response without content when no type exists', () => {
            const route = {
                path: '/test',
                httpMethod: 'get',
                target: TestController,
                propertyKey: 'test'
            } as any;

            (Metadata.get as jest.Mock).mockImplementation((key: MetadataKey) => {
                if (key === MetadataKeys.OPENAPI_RESPONSE) {
                    return [
                        {
                            statusCode: 204,
                            description: 'No content'
                        }
                    ];
                }

                return undefined;
            });

            generator.generate([route]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.paths['/test'].get.responses).toEqual({
                204: {
                    description: 'No content',
                    content: undefined
                }
            });
        });

        it('should generate a primitive response', () => {
            const route = {
                path: '/test',
                httpMethod: 'get',
                target: TestController,
                propertyKey: 'test'
            } as any;

            (Metadata.get as jest.Mock).mockImplementation((key: MetadataKey) => {
                if (key === MetadataKeys.OPENAPI_RESPONSE) {
                    return [
                        {
                            statusCode: 200,
                            description: 'Success',
                            type: 'string'
                        }
                    ];
                }

                return undefined;
            });

            generator.generate([route]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.paths['/test'].get.responses).toEqual({
                200: {
                    description: 'Success',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'string',
                                statusCode: 200,
                                description: 'Success'
                            }
                        }
                    }
                }
            });
        });

        it('should generate a class response as a reference', () => {
            class User {}

            const route = {
                path: '/users',
                httpMethod: 'get',
                target: TestController,
                propertyKey: 'test'
            } as any;

            (Metadata.get as jest.Mock).mockImplementation((key: MetadataKey, target?: any) => {
                if (key === MetadataKeys.OPENAPI_RESPONSE) {
                    return [
                        {
                            statusCode: 200,
                            description: 'User',
                            type: User
                        }
                    ];
                }

                if (key === MetadataKeys.OPENAPI_PROPERTY && target === User) {
                    return [];
                }

                return undefined;
            });

            generator.generate([route]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.paths['/users'].get.responses[200].content['application/json'].schema).toEqual({
                $ref: '#/components/schemas/User'
            });

            expect(definition.components.schemas.User).toBeDefined();
        });

        it('should support multiple response status codes', () => {
            const route = {
                path: '/test',
                httpMethod: 'get',
                target: TestController,
                propertyKey: 'test'
            } as any;

            (Metadata.get as jest.Mock).mockImplementation((key: MetadataKey) => {
                if (key === MetadataKeys.OPENAPI_RESPONSE) {
                    return [
                        {
                            statusCode: 200,
                            description: 'Success',
                            type: 'string'
                        },
                        {
                            statusCode: 400,
                            description: 'Bad request',
                            type: 'string'
                        },
                        {
                            statusCode: 404,
                            description: 'Not found'
                        }
                    ];
                }

                return undefined;
            });

            generator.generate([route]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(Object.keys(definition.paths['/test'].get.responses)).toEqual(['200', '400', '404']);
        });

        it('should overwrite duplicate status codes with the last response', () => {
            const route = {
                path: '/test',
                httpMethod: 'get',
                target: TestController,
                propertyKey: 'test'
            } as any;

            (Metadata.get as jest.Mock).mockImplementation((key: MetadataKey) => {
                if (key === MetadataKeys.OPENAPI_RESPONSE) {
                    return [
                        {
                            statusCode: 200,
                            description: 'First'
                        },
                        {
                            statusCode: 200,
                            description: 'Second'
                        }
                    ];
                }

                return undefined;
            });

            generator.generate([route]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.paths['/test'].get.responses[200].description).toBe('Second');
        });
    });

    describe('generateOpenApiObjectFromMetadata', () => {
        class TestController {
            test() {}
        }

        it.each([
            ['string', { type: 'string' }],
            ['number', { type: 'number' }],
            ['boolean', { type: 'boolean' }]
        ])('should generate metadata for primitive type %s', (type, _expected) => {
            const route = {
                path: '/test',
                httpMethod: 'get',
                target: TestController,
                propertyKey: 'test'
            } as any;

            (Metadata.get as jest.Mock).mockImplementation((key: MetadataKey) => {
                if (key === MetadataKeys.OPENAPI_PROPERTY) {
                    return [
                        {
                            propertyKey: 'value',
                            type
                        }
                    ];
                }

                return undefined;
            });

            generator.generate([route]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.components.schemas).toEqual({});
        });

        it('should preserve primitive metadata properties', () => {
            class TestDto {}

            const route = {
                path: '/test',
                httpMethod: 'post',
                target: TestController,
                propertyKey: 'test'
            } as any;

            (Metadata.get as jest.Mock).mockImplementation((key: MetadataKey, target?: any) => {
                parameterGenerator.generate.mockReturnValue([
                    {
                        parameter: 'body',
                        propertyKey: 'body',
                        target: TestController,
                        parameterIndex: 0
                    }
                ]);

                if (key === MetadataKeys.DESIGN_PARAM_TYPES) {
                    return [TestDto];
                }

                if (key === MetadataKeys.OPENAPI_PROPERTY && target === TestDto) {
                    return [
                        {
                            propertyKey: 'name',
                            type: 'string',
                            example: 'John',
                            default: 'Unknown',
                            minLength: 2,
                            maxLength: 100,
                            format: 'email',
                            target: TestDto
                        }
                    ];
                }

                return undefined;
            });

            generator.generate([route]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.components.schemas.TestDto.properties.name).toEqual({
                type: 'string',
                example: 'John',
                default: 'Unknown',
                minLength: 2,
                maxLength: 100,
                format: 'email'
            });
        });

        it('should generate an array of primitive values', () => {
            class TestDto {}

            const route = {
                path: '/test',
                httpMethod: 'post',
                target: TestController,
                propertyKey: 'test'
            } as any;

            (Metadata.get as jest.Mock).mockImplementation((key: MetadataKey, target?: any) => {
                parameterGenerator.generate.mockReturnValue([
                    {
                        parameter: 'body',
                        propertyKey: 'body',
                        target: TestController,
                        parameterIndex: 0
                    }
                ]);

                if (key === MetadataKeys.DESIGN_PARAM_TYPES) {
                    return [TestDto];
                }

                if (key === MetadataKeys.OPENAPI_PROPERTY && target === TestDto) {
                    return [
                        {
                            propertyKey: 'tags',
                            type: 'array',
                            items: [
                                {
                                    type: 'string'
                                }
                            ]
                        }
                    ];
                }

                return undefined;
            });

            generator.generate([route]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.components.schemas.TestDto.properties.tags).toEqual({
                type: 'array',
                items: {
                    type: 'string',
                    $ref: undefined
                },
                example: undefined,
                default: undefined,
                minItems: undefined,
                maxItems: undefined,
                uniqueItems: undefined
            });
        });

        it('should generate an array containing a class', () => {
            parameterGenerator = { generate: jest.fn().mockReturnValue([]) };
            generator = new OpenApiDocumentGenerator(options, parameterGenerator as any);

            class User {}
            class Group {}

            const route = {
                path: '/groups',
                httpMethod: 'post',
                target: TestController,
                propertyKey: 'test'
            } as any;

            (Metadata.get as jest.Mock).mockImplementation((key: MetadataKey, target?: any, _propertyKey?: any) => {
                parameterGenerator.generate.mockReturnValue([
                    {
                        parameter: 'body',
                        propertyKey: 'body',
                        target: TestController,
                        parameterIndex: 0
                    }
                ]);

                if (key === MetadataKeys.DESIGN_PARAM_TYPES && target === TestController.prototype) {
                    return [Group];
                }

                if (key === MetadataKeys.OPENAPI_SCHEMA) {
                    return undefined;
                }

                if (key === MetadataKeys.OPENAPI_PROPERTY && target === Group) {
                    return [
                        {
                            propertyKey: 'users',
                            type: 'array',
                            items: [
                                {
                                    type: User
                                }
                            ]
                        }
                    ];
                }

                if (key === MetadataKeys.OPENAPI_PROPERTY && target === User) {
                    return [];
                }

                return undefined;
            });

            generator.generate([route]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.components.schemas.Group.properties.users).toEqual({
                type: 'array',
                items: {
                    type: undefined,
                    $ref: '#/components/schemas/User'
                },
                example: undefined,
                default: undefined,
                minItems: undefined,
                maxItems: undefined,
                uniqueItems: undefined
            });

            expect(definition.components.schemas.User).toEqual({
                type: 'object',
                description: undefined,
                example: undefined,
                properties: undefined,
                required: undefined
            });
        });

        it('should generate an array without items', () => {
            parameterGenerator = { generate: jest.fn().mockReturnValue([]) };
            generator = new OpenApiDocumentGenerator(options, parameterGenerator as any);

            class User {}
            class Group {}

            const route = {
                path: '/groups',
                httpMethod: 'post',
                target: TestController,
                propertyKey: 'test'
            } as any;

            (Metadata.get as jest.Mock).mockImplementation((key: MetadataKey, target?: any, _propertyKey?: any) => {
                parameterGenerator.generate.mockReturnValue([
                    {
                        parameter: 'body',
                        propertyKey: 'body',
                        target: TestController,
                        parameterIndex: 0
                    }
                ]);

                if (key === MetadataKeys.OPENAPI_SCHEMA) {
                    return undefined;
                }

                if (key === MetadataKeys.DESIGN_PARAM_TYPES && target === TestController.prototype) {
                    return [Group];
                }

                if (key === MetadataKeys.OPENAPI_PROPERTY && target === Group) {
                    return [
                        {
                            propertyKey: 'users',
                            type: 'array',
                            items: []
                        }
                    ];
                }

                if (key === MetadataKeys.OPENAPI_PROPERTY && target === User) {
                    return [];
                }

                return undefined;
            });

            generator.generate([route]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.components.schemas.Group.properties.users).toEqual({
                type: 'array',
                example: undefined,
                default: undefined,
                minItems: undefined,
                maxItems: undefined,
                uniqueItems: undefined
            });
        });

        it('should generate oneOf for heterogeneous arrays', () => {
            class User {}
            class Product {}
            class SearchResult {}

            const route = {
                path: '/results',
                httpMethod: 'post',
                target: TestController,
                propertyKey: 'test'
            } as any;

            (Metadata.get as jest.Mock).mockImplementation((key: MetadataKey, target?: any) => {
                parameterGenerator.generate.mockReturnValue([
                    {
                        parameter: 'body',
                        propertyKey: 'body',
                        target: TestController,
                        parameterIndex: 0
                    }
                ]);

                if (key === MetadataKeys.DESIGN_PARAM_TYPES) {
                    return [SearchResult];
                }

                if (key === MetadataKeys.OPENAPI_PROPERTY && target === SearchResult) {
                    return [
                        {
                            propertyKey: 'results',
                            type: 'array',
                            items: [{ type: 'string' }, { type: User }, { type: Product }]
                        }
                    ];
                }

                if (key === MetadataKeys.OPENAPI_PROPERTY && (target === User || target === Product)) {
                    return [];
                }

                return undefined;
            });

            generator.generate([route]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.components.schemas.SearchResult.properties.results).toEqual({
                type: 'array',
                items: {
                    oneOf: [
                        {
                            type: 'string',
                            $ref: undefined
                        },
                        {
                            type: undefined,
                            $ref: '#/components/schemas/User'
                        },
                        {
                            type: undefined,
                            $ref: '#/components/schemas/Product'
                        }
                    ]
                },
                example: undefined,
                default: undefined,
                minItems: undefined,
                maxItems: undefined,
                uniqueItems: undefined
            });

            expect(definition.components.schemas.User).toBeDefined();
            expect(definition.components.schemas.Product).toBeDefined();
        });

        it('should include array constraints', () => {
            class TestDto {}

            const route = {
                path: '/test',
                httpMethod: 'post',
                target: TestController,
                propertyKey: 'test'
            } as any;

            (Metadata.get as jest.Mock).mockImplementation((key: MetadataKey, target?: any) => {
                parameterGenerator.generate.mockReturnValue([
                    {
                        parameter: 'body',
                        propertyKey: 'body',
                        target: TestController,
                        parameterIndex: 0
                    }
                ]);

                if (key === MetadataKeys.DESIGN_PARAM_TYPES) {
                    return [TestDto];
                }

                if (key === MetadataKeys.OPENAPI_PROPERTY && target === TestDto) {
                    return [
                        {
                            propertyKey: 'values',
                            type: 'array',
                            items: [{ type: 'number' }],
                            example: [1, 2],
                            default: [1],
                            minItems: 1,
                            maxItems: 10,
                            uniqueItems: true
                        }
                    ];
                }

                return undefined;
            });

            generator.generate([route]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.components.schemas.TestDto.properties.values).toEqual({
                type: 'array',
                items: {
                    type: 'number',
                    $ref: undefined
                },
                example: [1, 2],
                default: [1],
                minItems: 1,
                maxItems: 10,
                uniqueItems: true
            });
        });
    });

    describe('generateSpecialCaseResponses', () => {
        class OpenApiController {
            getOpenApi() {}
            getOpenApiJson() {}
            getOpenApiYaml() {}
        }

        it('should generate JSON response for getOpenApiJson', () => {
            const route = {
                path: '/openapi.json',
                httpMethod: 'get',
                target: OpenApiController,
                propertyKey: 'getOpenApiJson'
            } as any;

            generator.generate([route]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.paths['/openapi.json'].get.responses[200]).toEqual({
                description: 'Returns the OpenAPI document in JSON format',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object'
                        }
                    }
                }
            });
        });

        it('should generate YAML response for getOpenApiYaml', () => {
            const route = {
                path: '/openapi.yaml',
                httpMethod: 'get',
                target: OpenApiController,
                propertyKey: 'getOpenApiYaml'
            } as any;

            generator.generate([route]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.paths['/openapi.yaml'].get.responses[200]).toEqual({
                description: 'Returns the OpenAPI document in YAML format',
                content: {
                    'text/yaml': {
                        schema: {
                            type: 'string'
                        }
                    }
                }
            });
        });

        it('should treat non matching OpenAPI controller methods as yaml', () => {
            const route = {
                path: '/openapi',
                httpMethod: 'get',
                target: OpenApiController,
                propertyKey: 'somethingElse'
            } as any;

            generator.generate([route]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.paths['/openapi'].get.responses[200].content['text/yaml']).toBeDefined();
        });
    });

    describe('transformPathToOpenApiFormat', () => {
        class TestController {
            test() {}
        }

        it('should transform a single route parameter', () => {
            const route = {
                path: '/users/:id',
                httpMethod: 'get',
                target: TestController,
                propertyKey: 'test'
            } as any;

            generator.generate([route]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.paths['/users/{id}']).toBeDefined();
        });

        it('should transform multiple route parameters', () => {
            const route = {
                path: '/users/:userId/posts/:postId',
                httpMethod: 'get',
                target: TestController,
                propertyKey: 'test'
            } as any;

            generator.generate([route]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.paths['/users/{userId}/posts/{postId}']).toBeDefined();
        });

        it('should preserve paths without parameters', () => {
            const route = {
                path: '/users',
                httpMethod: 'get',
                target: TestController,
                propertyKey: 'test'
            } as any;

            generator.generate([route]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.paths['/users']).toBeDefined();
        });

        it('should support underscore and numbers in parameter names', () => {
            const route = {
                path: '/users/:user_id/:id2',
                httpMethod: 'get',
                target: TestController,
                propertyKey: 'test'
            } as any;

            generator.generate([route]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.paths['/users/{user_id}/{id2}']).toBeDefined();
        });

        it('should replace the valid prefix of an invalid parameter name', () => {
            const route = {
                path: '/users/:user-id',
                httpMethod: 'get',
                target: TestController,
                propertyKey: 'test'
            } as any;

            generator.generate([route]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.paths['/users/{user}-id']).toBeDefined();
        });
    });

    describe('generateOperationId', () => {
        it('should work with a symbol property key', () => {
            const propertyKey = Symbol('getUsers');

            class UsersController {}

            const route = {
                path: '/users',
                httpMethod: 'get',
                target: UsersController,
                propertyKey
            } as any;

            generator.generate([route]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.paths['/users'].get.operationId).toBe('users-symbol(getusers)');
        });

        it('should lowercase controller and method names', () => {
            class USERSController {
                GETUsers() {}
            }

            generator.generate([
                {
                    path: '/users',
                    httpMethod: 'get',
                    target: USERSController,
                    propertyKey: 'GETUsers'
                } as any
            ]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.paths['/users'].get.operationId).toBe('users-getusers');
        });

        it('should remove Controller case-insensitively', () => {
            class UsersCONTROLLER {
                get() {}
            }

            generator.generate([
                {
                    path: '/users',
                    httpMethod: 'get',
                    target: UsersCONTROLLER,
                    propertyKey: 'get'
                } as any
            ]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.paths['/users'].get.operationId).toBe('users-get');
        });
    });

    describe('extractTypeFromMetadata - edge cases', () => {
        class TestController {
            method() {}
        }

        it('should return Object when design type is Object', () => {
            (Metadata.get as jest.Mock).mockImplementation((key: MetadataKey) => {
                if (key === MetadataKeys.DESIGN_TYPE) {
                    return Object;
                }

                if (key === MetadataKeys.DESIGN_PARAM_TYPES) {
                    return [];
                }

                return undefined;
            });

            expect(OpenApiDocumentGenerator.extractTypeFromMetadata(TestController, 'method')).toBe(Object);
        });

        it('should return undefined when parameter index is out of bounds', () => {
            (Metadata.get as jest.Mock).mockImplementation((key: MetadataKey) => {
                if (key === MetadataKeys.DESIGN_TYPE) {
                    return String;
                }

                if (key === MetadataKeys.DESIGN_PARAM_TYPES) {
                    return [String];
                }

                return undefined;
            });

            expect(OpenApiDocumentGenerator.extractTypeFromMetadata(TestController, 'method', 10)).toBeUndefined();
        });

        it('should return undefined when parameter metadata is missing', () => {
            (Metadata.get as jest.Mock).mockImplementation((key: MetadataKey) => {
                if (key === MetadataKeys.DESIGN_TYPE) {
                    return String;
                }

                if (key === MetadataKeys.DESIGN_PARAM_TYPES) {
                    return undefined;
                }

                return undefined;
            });

            expect(OpenApiDocumentGenerator.extractTypeFromMetadata(TestController, 'method', 0)).toBeUndefined();
        });

        it.each([
            [String, 'string'],
            [Number, 'number'],
            [Boolean, 'boolean'],
            [Array, 'array'],
            [Date, 'string']
        ])('should correctly map reflected type %p', (reflectedType, expected) => {
            (Metadata.get as jest.Mock).mockImplementation((key: MetadataKey) => {
                if (key === MetadataKeys.DESIGN_TYPE) {
                    return reflectedType;
                }

                if (key === MetadataKeys.DESIGN_PARAM_TYPES) {
                    return [];
                }

                return undefined;
            });

            expect(OpenApiDocumentGenerator.extractTypeFromMetadata(TestController, 'method')).toBe(expected);
        });
    });

    describe('generateParameters - edge cases', () => {
        class TestController {
            test() {}
        }

        it('should return undefined when metadata is null', () => {
            const route = {
                path: '/test',
                httpMethod: 'get',
                target: TestController,
                propertyKey: 'test'
            } as any;

            parameterGenerator.generate.mockReturnValue([]);

            generator.generate([route]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.paths['/test'].get.parameters).toBeUndefined();
        });

        it('should return undefined when metadata is empty', () => {
            const route = {
                path: '/test',
                httpMethod: 'get',
                target: TestController,
                propertyKey: 'test'
            } as any;

            parameterGenerator.generate.mockReturnValue([]);

            generator.generate([route]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.paths['/test'].get.parameters).toBeUndefined();
        });

        it('should not include body parameters in the parameters array', () => {
            const route = {
                path: '/test',
                httpMethod: 'get',
                target: TestController,
                propertyKey: 'test'
            } as any;

            class BodyDto {}

            (Metadata.get as jest.Mock).mockImplementation((key: MetadataKey) => {
                parameterGenerator.generate.mockReturnValue([
                    {
                        parameter: 'body',
                        propertyKey: 'body',
                        target: TestController,
                        parameterIndex: 0
                    }
                ]);

                if (key === MetadataKeys.DESIGN_PARAM_TYPES) {
                    return [BodyDto];
                }

                if (key === MetadataKeys.OPENAPI_PROPERTY) {
                    return [];
                }

                return undefined;
            });

            generator.generate([route]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.paths['/test'].get.parameters).toBeUndefined();

            expect(definition.paths['/test'].get.requestBody).toBeDefined();
        });

        it('should support all OpenAPI parameter locations', () => {
            const route = {
                path: '/test',
                httpMethod: 'get',
                target: TestController,
                propertyKey: 'test'
            } as any;

            const parameterTypes = ['path', 'header', 'query', 'cookie'];

            (Metadata.get as jest.Mock).mockImplementation((key: MetadataKey) => {
                parameterGenerator.generate.mockReturnValue(
                    parameterTypes.map((parameter, parameterIndex) => ({
                        parameter,
                        propertyKey: `param${parameterIndex}`,
                        target: TestController,
                        parameterIndex
                    }))
                );

                if (key === MetadataKeys.DESIGN_PARAM_TYPES) {
                    return [String, Number, Boolean, Array];
                }

                return undefined;
            });

            generator.generate([route]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.paths['/test'].get.parameters).toEqual([
                {
                    name: 'param0',
                    in: 'path',
                    schema: {
                        type: 'string'
                    },
                    required: true
                },
                {
                    name: 'param1',
                    in: 'header',
                    schema: {
                        type: 'number'
                    },
                    required: undefined
                },
                {
                    name: 'param2',
                    in: 'query',
                    schema: {
                        type: 'boolean'
                    },
                    required: undefined
                },
                {
                    name: 'param3',
                    in: 'cookie',
                    schema: {
                        type: 'array'
                    },
                    required: undefined
                }
            ]);
        });
    });

    describe('generatePaths - edge cases', () => {
        class TestController {
            first() {}
            second() {}
        }

        it('should generate no paths for an empty route list', () => {
            generator.generate([]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.paths).toEqual({});
        });

        it('should preserve the HTTP method as provided by the route', () => {
            generator.generate([
                {
                    path: '/test',
                    httpMethod: 'patch',
                    target: TestController,
                    propertyKey: 'first'
                } as any
            ]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.paths['/test'].patch).toBeDefined();
        });

        it('should support several HTTP methods on different paths', () => {
            generator.generate([
                {
                    path: '/first',
                    httpMethod: 'get',
                    target: TestController,
                    propertyKey: 'first'
                },
                {
                    path: '/second',
                    httpMethod: 'delete',
                    target: TestController,
                    propertyKey: 'second'
                }
            ] as any);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.paths['/first'].get).toBeDefined();
            expect(definition.paths['/second'].delete).toBeDefined();
        });

        it('should overwrite the same HTTP method on the same path', () => {
            generator.generate([
                {
                    path: '/test',
                    httpMethod: 'get',
                    target: TestController,
                    propertyKey: 'first'
                },
                {
                    path: '/test',
                    httpMethod: 'get',
                    target: TestController,
                    propertyKey: 'second'
                }
            ] as any);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.paths['/test'].get.operationId).toBe('test-second');
        });
    });

    describe('schema dependency resolution', () => {
        it('should recursively generate schemas referenced by other schemas', () => {
            class Address {}
            class User {}
            class Company {}

            const route = {
                path: '/companies',
                httpMethod: 'post',
                target: class CompanyController {
                    create() {}
                },
                propertyKey: 'create'
            } as any;

            (Metadata.get as jest.Mock).mockImplementation((key: MetadataKey, target?: any) => {
                parameterGenerator.generate.mockReturnValue([
                    {
                        parameter: 'body',
                        propertyKey: 'body',
                        target: route.target,
                        parameterIndex: 0
                    }
                ]);

                if (key === MetadataKeys.DESIGN_PARAM_TYPES) {
                    return [Company];
                }

                if (key === MetadataKeys.OPENAPI_PROPERTY) {
                    if (target === Company) {
                        return [
                            {
                                propertyKey: 'owner',
                                type: User
                            }
                        ];
                    }

                    if (target === User) {
                        return [
                            {
                                propertyKey: 'address',
                                type: Address
                            }
                        ];
                    }

                    if (target === Address) {
                        return [
                            {
                                propertyKey: 'street',
                                type: 'string'
                            }
                        ];
                    }
                }

                return undefined;
            });

            generator.generate([route]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.components.schemas.Company).toBeDefined();
            expect(definition.components.schemas.User).toBeDefined();
            expect(definition.components.schemas.Address).toBeDefined();
        });

        it('should not generate the same schema twice', () => {
            class User {}

            const Controller = class UsersController {
                create() {}
                update() {}
            };

            const routes = [
                {
                    path: '/users',
                    httpMethod: 'post',
                    target: Controller,
                    propertyKey: 'create'
                },
                {
                    path: '/users/:id',
                    httpMethod: 'put',
                    target: Controller,
                    propertyKey: 'update'
                }
            ] as any[];

            (Metadata.get as jest.Mock).mockImplementation((key: MetadataKey, target?: any) => {
                parameterGenerator.generate.mockReturnValue([
                    {
                        parameter: 'body',
                        propertyKey: 'body',
                        target: Controller,
                        parameterIndex: 0
                    }
                ]);

                if (key === MetadataKeys.DESIGN_PARAM_TYPES) {
                    return [User];
                }

                if (key === MetadataKeys.OPENAPI_PROPERTY && target === User) {
                    return [];
                }

                return undefined;
            });

            generator.generate(routes);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(Object.keys(definition.components.schemas)).toEqual(['User']);
        });
    });

    describe('generate - repeated calls', () => {
        it('should generate independent documents on repeated calls', () => {
            class FirstDto {}
            class SecondDto {}

            const firstController = class FirstController {
                create() {}
            };

            const secondController = class SecondController {
                create() {}
            };

            const firstRoute = {
                path: '/first',
                httpMethod: 'post',
                target: firstController,
                propertyKey: 'create'
            } as any;

            const secondRoute = {
                path: '/second',
                httpMethod: 'post',
                target: secondController,
                propertyKey: 'create'
            } as any;

            (Metadata.get as jest.Mock).mockImplementation((key: MetadataKey, target?: any) => {
                if (key === MetadataKeys.DESIGN_PARAM_TYPES) {
                    if (target === firstController.prototype) {
                        return [FirstDto];
                    }

                    if (target === secondController.prototype) {
                        return [SecondDto];
                    }
                }

                if (key === MetadataKeys.OPENAPI_PROPERTY) {
                    return [];
                }

                return undefined;
            });

            parameterGenerator.generate.mockImplementation((_context, route) => {
                if (route.target === firstController) {
                    return [
                        {
                            parameter: 'body',
                            propertyKey: 'body',
                            target: firstController,
                            parameterIndex: 0
                        }
                    ];
                } else if (route.target === secondController) {
                    return [
                        {
                            parameter: 'body',
                            propertyKey: 'body',
                            target: secondController,
                            parameterIndex: 0
                        }
                    ];
                }
                return [];
            });

            const firstDocument = generator.generate([firstRoute]);
            const secondDocument = generator.generate([secondRoute]);

            expect(firstDocument).toBeDefined();
            expect(secondDocument).toBeDefined();

            const secondDefinition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[1][0];

            expect(secondDefinition.paths['/second']).toBeDefined();
            expect(secondDefinition.paths['/first']).toBeUndefined();

            expect(secondDefinition.components.schemas.SecondDto).toBeDefined();
            expect(secondDefinition.components.schemas.FirstDto).toBeUndefined();
        });
    });

    describe('extractTypeFromMetadata', () => {
        class TestController {
            method() {}
        }

        beforeEach(() => {
            (Metadata.get as jest.Mock).mockReturnValue(undefined);
        });

        it('should extract string from String metadata', () => {
            (Metadata.get as jest.Mock).mockReturnValueOnce(String).mockReturnValueOnce([]);

            expect(OpenApiDocumentGenerator.extractTypeFromMetadata(TestController, 'method')).toBe('string');
        });

        it('should extract string from Date metadata', () => {
            (Metadata.get as jest.Mock).mockReturnValueOnce(Date).mockReturnValueOnce([]);

            expect(OpenApiDocumentGenerator.extractTypeFromMetadata(TestController, 'method')).toBe('string');
        });

        it('should extract number from Number metadata', () => {
            (Metadata.get as jest.Mock).mockReturnValueOnce(Number).mockReturnValueOnce([]);

            expect(OpenApiDocumentGenerator.extractTypeFromMetadata(TestController, 'method')).toBe('number');
        });

        it('should extract boolean from Boolean metadata', () => {
            (Metadata.get as jest.Mock).mockReturnValueOnce(Boolean).mockReturnValueOnce([]);

            expect(OpenApiDocumentGenerator.extractTypeFromMetadata(TestController, 'method')).toBe('boolean');
        });

        it('should extract array from Array metadata', () => {
            (Metadata.get as jest.Mock).mockReturnValueOnce(Array).mockReturnValueOnce([]);

            expect(OpenApiDocumentGenerator.extractTypeFromMetadata(TestController, 'method')).toBe('array');
        });

        it('should return Object as a class type', () => {
            (Metadata.get as jest.Mock).mockReturnValueOnce(Object).mockReturnValueOnce([]);

            expect(OpenApiDocumentGenerator.extractTypeFromMetadata(TestController, 'method')).toBe(Object);
        });

        it('should extract a parameter type using parameterIndex', () => {
            (Metadata.get as jest.Mock).mockReturnValueOnce(String).mockReturnValueOnce([Number, String, Boolean]);

            expect(OpenApiDocumentGenerator.extractTypeFromMetadata(TestController, 'method', 1)).toBe('string');

            expect(Metadata.get).toHaveBeenCalledWith(MetadataKeys.DESIGN_PARAM_TYPES, TestController.prototype, 'method', false);
        });

        it('should return the parameter class when it is not a primitive', () => {
            class User {}

            (Metadata.get as jest.Mock).mockReturnValueOnce(String).mockReturnValueOnce([User]);

            expect(OpenApiDocumentGenerator.extractTypeFromMetadata(TestController, 'method', 0)).toBe(User);
        });
    });

    describe('generateOperationId', () => {
        it('should generate an operation id from controller and method names', () => {
            class UsersController {
                getUsers() {}
            }

            generator.generate([
                {
                    path: '/users',
                    httpMethod: 'get',
                    target: UsersController,
                    propertyKey: 'getUsers'
                } as any
            ]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.paths['/users'].get.operationId).toBe('users-getusers');
        });

        it('should remove Controller from the controller name', () => {
            class UserController {
                get() {}
            }

            generator.generate([
                {
                    path: '/users',
                    httpMethod: 'get',
                    target: UserController,
                    propertyKey: 'get'
                } as any
            ]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.paths['/users'].get.operationId).toBe('user-get');
        });
    });

    describe('generateParameters', () => {
        class TestController {
            test() {}
        }

        it.each([
            ['path', true],
            ['header', undefined],
            ['query', undefined],
            ['cookie', undefined]
        ])('should generate %s parameter', (parameterType, required) => {
            const route = {
                path: '/test',
                httpMethod: 'get',
                target: TestController,
                propertyKey: 'test'
            } as any;

            (Metadata.get as jest.Mock).mockReturnValue([
                {
                    parameter: parameterType,
                    propertyKey: 'id',
                    target: TestController,
                    parameterIndex: 0
                }
            ]);

            (Metadata.get as jest.Mock).mockImplementation((key: MetadataKey) => {
                parameterGenerator.generate.mockReturnValue([
                    {
                        parameter: parameterType,
                        propertyKey: 'id',
                        target: TestController,
                        parameterIndex: 0
                    }
                ]);

                if (key === MetadataKeys.DESIGN_PARAM_TYPES) {
                    return [String];
                }

                return undefined;
            });

            generator.generate([route]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.paths['/test'].get.parameters).toEqual([
                {
                    name: 'id',
                    in: parameterType,
                    schema: {
                        type: 'string'
                    },
                    required
                }
            ]);
        });

        it('should ignore unsupported parameter types', () => {
            const route = {
                path: '/test',
                httpMethod: 'get',
                target: TestController,
                propertyKey: 'test'
            } as any;

            (Metadata.get as jest.Mock).mockReturnValue([
                {
                    parameter: 'body',
                    propertyKey: 'body',
                    target: TestController,
                    parameterIndex: 0,
                    type: 'string'
                }
            ]);

            generator.generate([route]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.paths['/test'].get.parameters).toBeUndefined();
        });

        it('should use field as parameter name when available', () => {
            const route = {
                path: '/test',
                httpMethod: 'get',
                target: TestController,
                propertyKey: 'test'
            } as any;

            (Metadata.get as jest.Mock).mockImplementation((key: MetadataKey) => {
                parameterGenerator.generate.mockReturnValue([
                    {
                        parameter: 'query',
                        propertyKey: 'filter',
                        field: 'name',
                        target: TestController,
                        parameterIndex: 0
                    }
                ]);

                if (key === MetadataKeys.DESIGN_PARAM_TYPES) {
                    return [String];
                }

                return undefined;
            });

            generator.generate([route]);

            const definition = (OpenApiDocumentDefinition as jest.Mock).mock.calls[0][0];

            expect(definition.paths['/test'].get.parameters[0].name).toBe('name');
        });
    });
    describe('generateResponseSchemas', () => {
        class ProductDto {}
        class SchemaController {}
        const route = { path: '/products', httpMethod: 'get', target: SchemaController, propertyKey: 'find' } as any;

        it('should return the self-contained JSON schemas of the documented responses by status code', () => {
            (Metadata.get as jest.Mock).mockImplementation((key: MetadataKey, target: unknown) => {
                if (key === MetadataKeys.OPENAPI_RESPONSE && target === SchemaController) {
                    return [
                        { statusCode: 200, description: 'Product', type: ProductDto },
                        { statusCode: 204, description: 'No content' }
                    ];
                }
                return undefined;
            });

            generator.generate([route]);
            const schemas = generator.generateResponseSchemas(route) as any;

            expect(Object.keys(schemas)).toEqual(['200']);
            expect(schemas[200].$ref).toBe('#/components/schemas/ProductDto');
            expect(schemas[200].components.schemas.ProductDto).toEqual({ type: 'object' });
        });

        it('should return undefined for routes without documented JSON responses', () => {
            (Metadata.get as jest.Mock).mockImplementation((key: MetadataKey) =>
                key === MetadataKeys.OPENAPI_RESPONSE ? [{ statusCode: 204, description: 'No content' }] : undefined
            );
            const other = { ...route, path: '/other' };

            generator.generate([route, other]);

            expect(generator.generateResponseSchemas(route)).toBeUndefined();
            expect(generator.generateResponseSchemas({ ...route } as any)).toBeUndefined();
        });
    });
});
