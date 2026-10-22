import { AxiSparkContext, PluginNotConfiguredError } from '@axisparkjs/core';
import { Logger } from '@axisparkjs/logger';
import { HTTP_ADAPTER, HTTP_OPTIONS, HttpMethod } from '@axisparkjs/http';
import { Injector } from '@axisparkjs/di';

import { OpenApiPlugin } from './openapi-plugin';
import { OpenApiDocumentGenerator } from '../document/openapi-document-generator';
import { OPENAPI_LOGGER, OPENAPI_OPTIONS } from '../di';

describe('OpenApiPlugin', () => {
    let plugin: OpenApiPlugin;

    let logger: {
        child: jest.Mock;
        info: jest.Mock;
    };

    let injector: {
        get: jest.Mock;
    };

    let context: {
        container: {
            bind: jest.Mock;
        };
    };

    let httpAdapter: {
        registerRoutes: jest.Mock;
        getRegisteredRoutes: jest.Mock;
    };

    let httpOptions: {
        basePath: string;
    };

    let documentGenerator: {
        generate: jest.Mock;
    };

    let document: {
        toObject: jest.Mock;
        toYaml: jest.Mock;
    };

    const createOptions = (overrides = {}) =>
        ({
            info: {
                title: 'Test API',
                version: '1.0.0'
            },
            docsUrl: '/docs',
            exposeJson: true,
            exposeYaml: true,
            jsonDocumentUrl: 'openapi.json',
            yamlDocumentUrl: 'openapi.yaml',
            globalPrefix: true,
            ...overrides
        }) as any;

    const createContext = (): AxiSparkContext => context as unknown as AxiSparkContext;

    beforeEach(() => {
        jest.clearAllMocks();

        logger = {
            child: jest.fn(),
            info: jest.fn().mockResolvedValue(undefined)
        };

        logger.child.mockReturnValue(logger);

        httpOptions = {
            basePath: '/api'
        };

        httpAdapter = {
            registerRoutes: jest.fn(),
            getRegisteredRoutes: jest.fn().mockReturnValue([])
        };

        documentGenerator = {
            generate: jest.fn()
        };

        document = {
            toObject: jest.fn().mockReturnValue({
                openapi: '3.1.0'
            }),
            toYaml: jest.fn().mockReturnValue('openapi: 3.1.0')
        };

        documentGenerator.generate.mockReturnValue(document);

        injector = {
            get: jest.fn().mockImplementation((token) => {
                if (token === HTTP_OPTIONS) {
                    return Promise.resolve(httpOptions);
                }

                if (token === HTTP_ADAPTER) {
                    return Promise.resolve(httpAdapter);
                }

                if (token === OpenApiDocumentGenerator) {
                    return Promise.resolve(documentGenerator);
                }

                return Promise.resolve(undefined);
            })
        };

        context = {
            container: {
                bind: jest.fn()
            }
        };

        plugin = new OpenApiPlugin(logger as unknown as Logger, injector as unknown as Injector);
    });

    describe('dependencies', () => {
        it('should depend on HttpPlugin', () => {
            expect(OpenApiPlugin.dependencies).toHaveLength(1);
        });
    });

    describe('onRegister', () => {
        it('should throw PluginNotConfiguredError when options are not provided', async () => {
            await expect(plugin.onRegister(createContext())).rejects.toBeInstanceOf(PluginNotConfiguredError);

            expect(logger.child).not.toHaveBeenCalled();
            expect(injector.get).not.toHaveBeenCalled();
            expect(httpAdapter.registerRoutes).not.toHaveBeenCalled();
        });

        it('should store the context and options', async () => {
            const options = createOptions();

            await plugin.onRegister(createContext(), options);

            expect((plugin as any).context).toBe(context);
            expect((plugin as any).options).toBe(options);
        });

        it('should create a child logger', async () => {
            const options = createOptions();

            await plugin.onRegister(createContext(), options);

            expect(logger.child).toHaveBeenCalledTimes(1);
            expect(logger.child).toHaveBeenCalledWith('OpenApiPlugin');
        });

        it('should resolve HTTP options from the injector', async () => {
            const options = createOptions();

            await plugin.onRegister(createContext(), options);

            expect(injector.get).toHaveBeenCalledWith(HTTP_OPTIONS);
        });

        it('should resolve HTTP adapter from the injector', async () => {
            const options = createOptions();

            await plugin.onRegister(createContext(), options);

            expect(injector.get).toHaveBeenCalledWith(HTTP_ADAPTER);
        });

        it('should register OpenAPI options in the container', async () => {
            const options = createOptions();

            await plugin.onRegister(createContext(), options);

            expect(context.container.bind).toHaveBeenCalledWith({
                token: OPENAPI_OPTIONS,
                useValue: options
            });
        });

        it('should register OpenAPI logger in the container', async () => {
            const options = createOptions();

            await plugin.onRegister(createContext(), options);

            expect(context.container.bind).toHaveBeenCalledWith({
                token: OPENAPI_LOGGER,
                useValue: logger
            });
        });

        it('should generate the document after registering routes', async () => {
            const options = createOptions();

            await plugin.onRegister(createContext(), options);

            const registerRoutesOrder = httpAdapter.registerRoutes.mock.invocationCallOrder[0];

            const generateOrder = documentGenerator.generate.mock.invocationCallOrder[0];

            expect(registerRoutesOrder).toBeLessThan(generateOrder);
        });

        it('should log that the plugin was registered', async () => {
            const options = createOptions();

            await plugin.onRegister(createContext(), options);

            expect(logger.info).toHaveBeenCalledWith('Plugin registered');
        });
    });

    describe('generateDocsUrl', () => {
        it('should include the HTTP base path when globalPrefix is enabled', async () => {
            await plugin.onRegister(
                createContext(),
                createOptions({
                    globalPrefix: true,
                    docsUrl: '/docs',
                    jsonDocumentUrl: '/openapi.json',
                    yamlDocumentUrl: '/openapi.yaml'
                })
            );

            expect((plugin as any).docsUrls).toEqual({
                jsonUrl: '/api/docs/openapi.json',
                yamlUrl: '/api/docs/openapi.yaml'
            });
        });

        it('should not include the HTTP base path when globalPrefix is disabled', async () => {
            await plugin.onRegister(
                createContext(),
                createOptions({
                    globalPrefix: false,
                    docsUrl: '/docs',
                    jsonDocumentUrl: '/openapi.json',
                    yamlDocumentUrl: '/openapi.yaml'
                })
            );

            expect((plugin as any).docsUrls).toEqual({
                jsonUrl: '/docs/openapi.json',
                yamlUrl: '/docs/openapi.yaml'
            });
        });

        it('should add a leading slash to basePath', async () => {
            httpOptions.basePath = 'api';

            await plugin.onRegister(
                createContext(),
                createOptions({
                    globalPrefix: true,
                    docsUrl: 'docs',
                    jsonDocumentUrl: 'openapi.json',
                    yamlDocumentUrl: 'openapi.yaml'
                })
            );

            expect((plugin as any).docsUrls).toEqual({
                jsonUrl: '/api/docs/openapi.json',
                yamlUrl: '/api/docs/openapi.yaml'
            });
        });

        it('should add a leading slash to docsUrl', async () => {
            await plugin.onRegister(
                createContext(),
                createOptions({
                    docsUrl: 'docs',
                    jsonDocumentUrl: 'openapi.json',
                    yamlDocumentUrl: 'openapi.yaml'
                })
            );

            expect((plugin as any).docsUrls).toEqual({
                jsonUrl: '/api/docs/openapi.json',
                yamlUrl: '/api/docs/openapi.yaml'
            });
        });

        it('should add a leading slash to document URLs', async () => {
            await plugin.onRegister(
                createContext(),
                createOptions({
                    docsUrl: 'docs',
                    jsonDocumentUrl: 'openapi.json',
                    yamlDocumentUrl: 'openapi.yaml'
                })
            );

            expect((plugin as any).docsUrls).toEqual({
                jsonUrl: '/api/docs/openapi.json',
                yamlUrl: '/api/docs/openapi.yaml'
            });
        });

        it('should remove duplicated slashes', async () => {
            httpOptions.basePath = '//api//';

            await plugin.onRegister(
                createContext(),
                createOptions({
                    docsUrl: '//docs//',
                    jsonDocumentUrl: '//openapi.json//',
                    yamlDocumentUrl: '//openapi.yaml//'
                })
            );

            expect((plugin as any).docsUrls).toEqual({
                jsonUrl: '/api/docs/openapi.json',
                yamlUrl: '/api/docs/openapi.yaml'
            });
        });

        it('should remove the trailing slash', async () => {
            await plugin.onRegister(
                createContext(),
                createOptions({
                    globalPrefix: false,
                    docsUrl: '/docs/',
                    jsonDocumentUrl: '/openapi.json/',
                    yamlDocumentUrl: '/openapi.yaml/'
                })
            );

            expect((plugin as any).docsUrls).toEqual({
                jsonUrl: '/docs/openapi.json',
                yamlUrl: '/docs/openapi.yaml'
            });
        });

        it('should use the default JSON document URL when it is undefined', async () => {
            await plugin.onRegister(
                createContext(),
                createOptions({
                    jsonDocumentUrl: undefined
                })
            );

            expect((plugin as any).docsUrls.jsonUrl).toBe('/api/docs/openapi.json');
        });

        it('should use the default YAML document URL when it is undefined', async () => {
            await plugin.onRegister(
                createContext(),
                createOptions({
                    yamlDocumentUrl: undefined
                })
            );

            expect((plugin as any).docsUrls.yamlUrl).toBe('/api/docs/openapi.yml');
        });

        it('should use an empty docs URL when docsUrl is undefined', async () => {
            await plugin.onRegister(
                createContext(),
                createOptions({
                    docsUrl: undefined
                })
            );

            expect((plugin as any).docsUrls).toEqual({
                jsonUrl: '/api/openapi.json',
                yamlUrl: '/api/openapi.yaml'
            });
        });

        it('should return / when the generated URL is empty', async () => {
            httpOptions.basePath = '';

            await plugin.onRegister(
                createContext(),
                createOptions({
                    globalPrefix: false,
                    docsUrl: '',
                    jsonDocumentUrl: '',
                    yamlDocumentUrl: ''
                })
            );

            expect((plugin as any).docsUrls).toEqual({
                jsonUrl: '/',
                yamlUrl: '/'
            });
        });
    });

    describe('configureRoutes', () => {
        it('should register both JSON and YAML routes by default', async () => {
            await plugin.onRegister(
                createContext(),
                createOptions({
                    exposeJson: true,
                    exposeYaml: true
                })
            );

            expect(httpAdapter.registerRoutes).toHaveBeenCalledTimes(1);

            const [routes] = httpAdapter.registerRoutes.mock.calls[0];

            expect(routes).toHaveLength(2);
        });

        it('should only register JSON when exposeJson is true and exposeYaml is false', async () => {
            await plugin.onRegister(
                createContext(),
                createOptions({
                    exposeJson: true,
                    exposeYaml: false
                })
            );

            const [routes] = httpAdapter.registerRoutes.mock.calls[0];

            expect(routes).toHaveLength(1);
            expect(routes[0]).toEqual(
                expect.objectContaining({
                    propertyKey: 'getOpenApiJson',
                    path: '/api/docs/openapi.json',
                    httpMethod: HttpMethod.Get,
                    versions: ['*'],
                    hosts: ['*']
                })
            );
        });

        it('should only register YAML when exposeJson is false and exposeYaml is true', async () => {
            await plugin.onRegister(
                createContext(),
                createOptions({
                    exposeJson: false,
                    exposeYaml: true
                })
            );

            const [routes] = httpAdapter.registerRoutes.mock.calls[0];

            expect(routes).toHaveLength(1);
            expect(routes[0]).toEqual(
                expect.objectContaining({
                    propertyKey: 'getOpenApiYaml',
                    path: '/api/docs/openapi.yaml',
                    httpMethod: HttpMethod.Get,
                    versions: ['*'],
                    hosts: ['*']
                })
            );
        });

        it('should register no routes when both formats are disabled', async () => {
            await plugin.onRegister(
                createContext(),
                createOptions({
                    exposeJson: false,
                    exposeYaml: false
                })
            );

            expect(httpAdapter.registerRoutes).toHaveBeenCalledWith([]);

            expect(httpAdapter.registerRoutes).toHaveBeenCalledTimes(1);
        });

        it('should register the correct JSON route', async () => {
            await plugin.onRegister(
                createContext(),
                createOptions({
                    docsUrl: '/documentation',
                    jsonDocumentUrl: 'api.json',
                    exposeJson: true,
                    exposeYaml: false
                })
            );

            const [routes] = httpAdapter.registerRoutes.mock.calls[0];

            expect(routes[0]).toEqual(
                expect.objectContaining({
                    target: {
                        name: 'OpenApiController'
                    },
                    propertyKey: 'getOpenApiJson',
                    path: '/api/documentation/api.json',
                    httpMethod: HttpMethod.Get,
                    versions: ['*'],
                    hosts: ['*'],
                    handler: expect.any(Function)
                })
            );
        });

        it('should register the correct YAML route', async () => {
            await plugin.onRegister(
                createContext(),
                createOptions({
                    docsUrl: '/documentation',
                    yamlDocumentUrl: 'api.yaml',
                    exposeJson: false,
                    exposeYaml: true
                })
            );

            const [routes] = httpAdapter.registerRoutes.mock.calls[0];

            expect(routes[0]).toEqual(
                expect.objectContaining({
                    target: {
                        name: 'OpenApiController'
                    },
                    propertyKey: 'getOpenApiYaml',
                    path: '/api/documentation/api.yaml',
                    httpMethod: HttpMethod.Get,
                    versions: ['*'],
                    hosts: ['*'],
                    handler: expect.any(Function)
                })
            );
        });

        it('should use the JSON document in the JSON handler', async () => {
            await plugin.onRegister(
                createContext(),
                createOptions({
                    exposeJson: true,
                    exposeYaml: false
                })
            );

            const [routes] = httpAdapter.registerRoutes.mock.calls[0];
            const jsonRoute = routes[0];

            const response = {
                json: jest.fn()
            };

            await jsonRoute.handler({
                response
            });

            expect(document.toObject).toHaveBeenCalledTimes(1);
            expect(response.json).toHaveBeenCalledWith(document.toObject());
        });

        it('should use the YAML document in the YAML handler', async () => {
            await plugin.onRegister(
                createContext(),
                createOptions({
                    exposeJson: false,
                    exposeYaml: true
                })
            );

            const [routes] = httpAdapter.registerRoutes.mock.calls[0];
            const yamlRoute = routes[0];

            const response = {
                header: jest.fn().mockReturnThis(),
                send: jest.fn()
            };

            await yamlRoute.handler({
                response
            });

            expect(document.toYaml).toHaveBeenCalledTimes(1);

            expect(response.header).toHaveBeenCalledWith('Content-Type', 'text/yaml');

            expect(response.send).toHaveBeenCalledWith(document.toYaml());
        });

        it('should define both handlers when both formats are exposed', async () => {
            await plugin.onRegister(
                createContext(),
                createOptions({
                    exposeJson: true,
                    exposeYaml: true
                })
            );

            const [routes] = httpAdapter.registerRoutes.mock.calls[0];

            expect(routes[0].handler).toEqual(expect.any(Function));
            expect(routes[1].handler).toEqual(expect.any(Function));
        });
    });

    describe('generateDocument', () => {
        it('should resolve OpenApiDocumentGenerator from the injector', async () => {
            await plugin.onRegister(createContext(), createOptions());

            expect(injector.get).toHaveBeenCalledWith(OpenApiDocumentGenerator);
        });

        it('should pass registered HTTP routes to the document generator', async () => {
            const routes = [
                {
                    path: '/users',
                    propertyKey: 'getUsers'
                },
                {
                    path: '/users/:id',
                    propertyKey: 'getUser'
                }
            ];

            httpAdapter.getRegisteredRoutes.mockReturnValue(routes);

            await plugin.onRegister(createContext(), createOptions());

            expect(documentGenerator.generate).toHaveBeenCalledWith(routes);
        });

        it('should store the generated document', async () => {
            await plugin.onRegister(createContext(), createOptions());

            expect((plugin as any).document).toBe(document);
        });

        it('should get registered routes before generating the document', async () => {
            const calls: string[] = [];

            httpAdapter.getRegisteredRoutes.mockImplementation(() => {
                calls.push('getRegisteredRoutes');
                return [];
            });

            documentGenerator.generate.mockImplementation(() => {
                calls.push('generate');
                return document;
            });

            await plugin.onRegister(createContext(), createOptions());

            expect(calls).toEqual(['getRegisteredRoutes', 'generate']);
        });
    });

    describe('onStart', () => {
        it('should log that the plugin has started', async () => {
            await plugin.onRegister(createContext(), createOptions());

            logger.info.mockClear();

            await plugin.onStart();

            expect(logger.info).toHaveBeenCalledWith('Plugin started. OpenAPI documentation available');
        });

        it('should log the JSON URL when JSON is exposed', async () => {
            await plugin.onRegister(
                createContext(),
                createOptions({
                    exposeJson: true,
                    exposeYaml: false
                })
            );

            logger.info.mockClear();

            await plugin.onStart();

            expect(logger.info).toHaveBeenCalledWith('JSON: /api/docs/openapi.json');
        });

        it('should log Not exposed for JSON when JSON is disabled', async () => {
            await plugin.onRegister(
                createContext(),
                createOptions({
                    exposeJson: false,
                    exposeYaml: true
                })
            );

            logger.info.mockClear();

            await plugin.onStart();

            expect(logger.info).toHaveBeenCalledWith('JSON: Not exposed');
        });

        it('should log the YAML URL when YAML is exposed', async () => {
            await plugin.onRegister(
                createContext(),
                createOptions({
                    exposeJson: false,
                    exposeYaml: true
                })
            );

            logger.info.mockClear();

            await plugin.onStart();

            expect(logger.info).toHaveBeenCalledWith('YAML: /api/docs/openapi.yaml');
        });

        it('should log Not exposed for YAML when YAML is disabled', async () => {
            await plugin.onRegister(
                createContext(),
                createOptions({
                    exposeJson: true,
                    exposeYaml: false
                })
            );

            logger.info.mockClear();

            await plugin.onStart();

            expect(logger.info).toHaveBeenCalledWith('YAML: Not exposed');
        });

        it('should log all three startup messages', async () => {
            await plugin.onRegister(
                createContext(),
                createOptions({
                    exposeJson: true,
                    exposeYaml: true
                })
            );

            logger.info.mockClear();

            await plugin.onStart();

            expect(logger.info).toHaveBeenCalledTimes(3);

            expect(logger.info).toHaveBeenNthCalledWith(1, 'Plugin started. OpenAPI documentation available');

            expect(logger.info).toHaveBeenNthCalledWith(2, 'JSON: /api/docs/openapi.json');

            expect(logger.info).toHaveBeenNthCalledWith(3, 'YAML: /api/docs/openapi.yaml');
        });
    });

    describe('onStop', () => {
        it('should log that the plugin has stopped', async () => {
            await plugin.onStop();

            expect(logger.info).toHaveBeenCalledWith('Plugin stopped');

            expect(logger.info).toHaveBeenCalledTimes(1);
        });
    });
});
