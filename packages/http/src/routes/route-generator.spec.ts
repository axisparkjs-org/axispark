import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { ClassRegistry } from '@axisparkjs/di';
import { ExecutionTransport } from '@axisparkjs/engine';
import { RouteGenerator } from './route-generator';
import { RouteDefinition } from './route-definition';
import { VersionType } from '../version';
import { HttpPluginOptions } from '../plugin/http-plugin-options';

jest.mock('@axisparkjs/common', () => ({
    ...jest.requireActual('@axisparkjs/common'),
    ClassRegistry: {
        getWithMetadata: jest.fn()
    },
    Metadata: {
        get: jest.fn(),
        normalizeTarget: jest.fn((target) => target),
        define: jest.fn()
    }
}));

describe('RouteGenerator', () => {
    const request = {} as any;
    class TestController {}

    const httpEngine = {
        execute: jest.fn(),
        versionMapping: jest.fn()
    };

    const scopedContainerManager = {
        create: jest.fn().mockReturnValue({})
    };

    const rateLimitResolver = {
        consume: jest.fn().mockReturnValue({ allowed: true, retryAfterMs: 0 }),
        getMessage: jest.fn().mockReturnValue('Too many requests')
    };

    const createGenerator = (options: Partial<HttpPluginOptions> = {}) => {
        return new RouteGenerator(
            httpEngine as any,
            scopedContainerManager as any,
            {
                adapter: class TestAdapter {},
                port: 3000,
                basePath: '',
                version: false,
                ...options
            } as HttpPluginOptions,
            rateLimitResolver as any
        );
    };

    const setupMetadata = (controllerMetadata: any, routesMetadata: any[]) => {
        (ClassRegistry.getWithMetadata as jest.Mock).mockReturnValue([TestController]);

        (Metadata.get as jest.Mock).mockReturnValueOnce(controllerMetadata).mockReturnValueOnce(routesMetadata);
    };

    beforeEach(() => {
        jest.clearAllMocks();
        ClassRegistry.getWithMetadata = jest.fn().mockReturnValue([]);
        (Metadata.get as jest.Mock).mockReset();
        httpEngine.execute.mockReset();
        httpEngine.versionMapping.mockReset();
        scopedContainerManager.create.mockClear();
        rateLimitResolver.consume.mockReset().mockReturnValue({ allowed: true, retryAfterMs: 0 });
        rateLimitResolver.getMessage.mockReset().mockReturnValue('Too many requests');
    });

    describe('generate', () => {
        it('should return an empty array when there are no controllers', async () => {
            const generator = createGenerator();

            (ClassRegistry.getWithMetadata as jest.Mock).mockReturnValue([]);

            const result = await generator.generate();

            expect(result).toEqual([]);
            expect(Metadata.get).not.toHaveBeenCalled();
        });

        it('should generate a route definition for each route', async () => {
            setupMetadata(
                {
                    prefix: 'users'
                },
                [
                    {
                        target: TestController,
                        propertyKey: 'index',
                        method: 'GET',
                        path: '/'
                    },
                    {
                        target: TestController,
                        propertyKey: 'create',
                        method: 'POST',
                        path: '/'
                    }
                ]
            );

            const generator = createGenerator();

            const result = await generator.generate();

            expect(result).toHaveLength(2);
            expect(result[0]).toBeInstanceOf(RouteDefinition);
            expect(result[1]).toBeInstanceOf(RouteDefinition);
        });

        it('should apply the global rate limit and execute allowed requests', async () => {
            const routeMetadata = {
                target: TestController,
                propertyKey: 'index',
                method: 'GET',
                path: '/items'
            };
            setupMetadata({ prefix: 'users' }, [routeMetadata]);
            (Metadata.get as jest.Mock).mockReturnValueOnce(undefined).mockReturnValueOnce(undefined);

            const generator = createGenerator({ rateLimit: true });
            const [route] = await generator.generate();
            const response = { status: jest.fn().mockReturnThis(), header: jest.fn().mockReturnThis(), json: jest.fn() };

            await route.handler({
                request: { ip: '127.0.0.1' },
                response
            } as any);

            expect(rateLimitResolver.consume).toHaveBeenCalledWith('127.0.0.1', 'GET:/users/items:TestController.index', {});
            expect(httpEngine.execute).toHaveBeenCalledTimes(1);
            expect(response.status).not.toHaveBeenCalled();
        });

        it('should respond with a rate limit error and skip the handler when over the limit', async () => {
            setupMetadata({ prefix: 'users' }, [{ target: TestController, propertyKey: 'index', method: 'GET', path: '/items' }]);
            (Metadata.get as jest.Mock).mockReturnValueOnce(undefined).mockReturnValueOnce(undefined);
            rateLimitResolver.consume.mockReturnValue({ allowed: false, retryAfterMs: 1_500 });

            const generator = createGenerator({ rateLimit: true });
            const [route] = await generator.generate();
            const response = { status: jest.fn().mockReturnThis(), header: jest.fn().mockReturnThis(), json: jest.fn() };

            await route.handler({ request: { ip: '127.0.0.1' }, response } as any);

            expect(response.status).toHaveBeenCalledWith(429);
            expect(response.header).toHaveBeenCalledWith('Retry-After', '2');
            expect(response.json).toHaveBeenCalledWith({ message: 'Too many requests' });
            expect(httpEngine.execute).not.toHaveBeenCalled();
        });

        it('should use handler metadata to disable rate limiting', async () => {
            setupMetadata({ prefix: 'users' }, [{ target: TestController, propertyKey: 'index', method: 'GET', path: '/items' }]);
            (Metadata.get as jest.Mock).mockReturnValueOnce({ disabled: true }).mockReturnValueOnce(undefined);

            const generator = createGenerator({ rateLimit: true });
            const [route] = await generator.generate();

            await route.handler({ request: { ip: '127.0.0.1' }, response: {} } as any);

            expect(rateLimitResolver.consume).not.toHaveBeenCalled();
            expect(httpEngine.execute).toHaveBeenCalledTimes(1);
        });

        it('should use handler rate limit metadata with omitted options', async () => {
            setupMetadata({ prefix: 'users' }, [{ target: TestController, propertyKey: 'index', method: 'GET', path: '/items' }]);
            (Metadata.get as jest.Mock).mockReturnValueOnce({ disabled: false }).mockReturnValueOnce(undefined);

            const generator = createGenerator({ rateLimit: true });
            const [route] = await generator.generate();

            await route.handler({ request: { ip: '127.0.0.1' }, response: {} } as any);

            expect(rateLimitResolver.consume).toHaveBeenCalledWith('127.0.0.1', 'GET:/users/items:TestController.index', {});
        });

        it('should use controller rate limit metadata when the handler has none', async () => {
            setupMetadata({ prefix: 'users' }, [{ target: TestController, propertyKey: 'index', method: 'GET', path: '/items' }]);
            (Metadata.get as jest.Mock).mockReturnValueOnce(undefined).mockReturnValueOnce({ disabled: false, options: { limit: 3 } });

            const generator = createGenerator({ rateLimit: true });
            const [route] = await generator.generate();

            await route.handler({ request: { ip: '127.0.0.1' }, response: {} } as any);

            expect(rateLimitResolver.consume).toHaveBeenCalledWith('127.0.0.1', 'GET:/users/items:TestController.index', { limit: 3 });
        });

        it('should ignore rate limit decorators when rate limiting is disabled', async () => {
            setupMetadata({ prefix: 'users' }, [{ target: TestController, propertyKey: 'index', method: 'GET', path: '/items' }]);

            const generator = createGenerator({ rateLimit: false });
            const [route] = await generator.generate();

            await route.handler({ request: { ip: '127.0.0.1' }, response: {} } as any);

            expect(Metadata.get).toHaveBeenCalledTimes(2);
            expect(rateLimitResolver.consume).not.toHaveBeenCalled();
            expect(httpEngine.execute).toHaveBeenCalledTimes(1);
        });

        it('should bypass rate limits declared disabled on the controller', async () => {
            setupMetadata({ prefix: 'users' }, [{ target: TestController, propertyKey: 'index', method: 'GET', path: '/items' }]);
            (Metadata.get as jest.Mock).mockReturnValueOnce(undefined).mockReturnValueOnce({ disabled: true });

            const generator = createGenerator({ rateLimit: true });
            const [route] = await generator.generate();

            await route.handler({ request: { ip: '127.0.0.1' }, response: {} } as any);

            expect(rateLimitResolver.consume).not.toHaveBeenCalled();
            expect(httpEngine.execute).toHaveBeenCalledTimes(1);
        });

        it('should use the controller prefix and route path', async () => {
            setupMetadata(
                {
                    prefix: 'users'
                },
                [
                    {
                        target: TestController,
                        propertyKey: 'index',
                        method: 'GET',
                        path: 'list'
                    }
                ]
            );

            const generator = createGenerator({
                basePath: '/api'
            });

            const result = await generator.generate();

            expect(result[0].path).toBe('/api/users/list');
        });

        it('should normalize slashes in the generated path', async () => {
            setupMetadata(
                {
                    prefix: '/users/'
                },
                [
                    {
                        target: TestController,
                        propertyKey: 'index',
                        method: 'GET',
                        path: '/list/'
                    }
                ]
            );

            const generator = createGenerator({
                basePath: '///api///'
            });

            const result = await generator.generate();

            expect(result[0].path).toBe('/api/users/list');
        });

        it('should generate the root path correctly', async () => {
            setupMetadata(
                {
                    prefix: ''
                },
                [
                    {
                        target: TestController,
                        propertyKey: 'index',
                        method: 'GET',
                        path: '/'
                    }
                ]
            );

            const generator = createGenerator();

            const result = await generator.generate();

            expect(result[0].path).toBe('/');
        });

        it('should use undefined versions when versioning is disabled', async () => {
            setupMetadata(
                {
                    prefix: 'users',
                    version: '1'
                },
                [
                    {
                        target: TestController,
                        propertyKey: 'index',
                        method: 'GET',
                        path: '/',
                        version: '2'
                    }
                ]
            );

            const generator = createGenerator({
                version: false
            });

            const result = await generator.generate();

            expect(result).toHaveLength(1);
            expect(result[0].versions).toBeUndefined();
        });

        it('should use the route version when versioning is enabled', async () => {
            setupMetadata(
                {
                    prefix: 'users',
                    version: '1'
                },
                [
                    {
                        target: TestController,
                        propertyKey: 'index',
                        method: 'GET',
                        path: '/',
                        version: '2'
                    }
                ]
            );

            const generator = createGenerator({
                version: true,
                versionOptions: {
                    type: VersionType.Header
                } as any
            });

            const result = await generator.generate();

            expect(result).toHaveLength(1);
            expect(result[0].versions).toEqual(['2']);
        });

        it('should prefer the route version over the controller version', async () => {
            setupMetadata(
                {
                    prefix: 'users',
                    version: '1'
                },
                [
                    {
                        target: TestController,
                        propertyKey: 'index',
                        method: 'GET',
                        path: '/',
                        version: '2'
                    }
                ]
            );

            const generator = createGenerator({
                version: true,
                versionOptions: {
                    type: VersionType.Header
                } as any
            });

            const result = await generator.generate();

            expect(result[0].versions).toEqual(['2']);
        });

        it('should use the controller version when route version is not defined', async () => {
            setupMetadata(
                {
                    prefix: 'users',
                    version: '1'
                },
                [
                    {
                        target: TestController,
                        propertyKey: 'index',
                        method: 'GET',
                        path: '/'
                    }
                ]
            );

            const generator = createGenerator({
                version: true,
                versionOptions: {
                    type: VersionType.Header
                } as any
            });

            const result = await generator.generate();

            expect(result[0].versions).toEqual(['1']);
        });

        it('should support multiple route versions', async () => {
            setupMetadata(
                {
                    prefix: 'users'
                },
                [
                    {
                        target: TestController,
                        propertyKey: 'index',
                        method: 'GET',
                        path: '/',
                        version: ['1', '2']
                    }
                ]
            );

            const generator = createGenerator({
                version: true,
                versionOptions: {
                    type: VersionType.Header
                } as any
            });

            const result = await generator.generate();

            expect(result[0].versions).toEqual(['1', '2']);
        });

        it('should support multiple controller versions', async () => {
            setupMetadata(
                {
                    prefix: 'users',
                    version: ['1', '2']
                },
                [
                    {
                        target: TestController,
                        propertyKey: 'index',
                        method: 'GET',
                        path: '/'
                    }
                ]
            );

            const generator = createGenerator({
                version: true,
                versionOptions: {
                    type: VersionType.Header
                } as any
            });

            const result = await generator.generate();

            expect(result[0].versions).toEqual(['1', '2']);
        });

        it('should use the URI default version when no route or controller version exists', async () => {
            setupMetadata(
                {
                    prefix: 'users'
                },
                [
                    {
                        target: TestController,
                        propertyKey: 'index',
                        method: 'GET',
                        path: '/'
                    }
                ]
            );

            const generator = createGenerator({
                version: true,
                versionOptions: {
                    type: VersionType.Uri,
                    defaultVersion: '1'
                } as any
            });

            const result = await generator.generate();

            expect(result[0].versions).toEqual(['1']);
        });

        it('should use default as the version when no version is configured', async () => {
            setupMetadata(
                {
                    prefix: 'users'
                },
                [
                    {
                        target: TestController,
                        propertyKey: 'index',
                        method: 'GET',
                        path: '/'
                    }
                ]
            );

            const generator = createGenerator({
                version: true,
                versionOptions: {
                    type: VersionType.Header
                } as any
            });

            const result = await generator.generate();

            expect(result[0].versions).toEqual(['default']);
        });

        it('should use default as the version when URI versioning has no defaultVersion', async () => {
            setupMetadata(
                {
                    prefix: 'users'
                },
                [
                    {
                        target: TestController,
                        propertyKey: 'index',
                        method: 'GET',
                        path: '/'
                    }
                ]
            );

            const generator = createGenerator({
                version: true,
                versionOptions: {
                    type: VersionType.Uri
                } as any
            });

            const result = await generator.generate();

            expect(result[0].versions).toEqual(['default']);
        });

        it('should add the version parameter to the path for URI versioning', async () => {
            setupMetadata(
                {
                    prefix: 'users'
                },
                [
                    {
                        target: TestController,
                        propertyKey: 'index',
                        method: 'GET',
                        path: '/'
                    }
                ]
            );

            const generator = createGenerator({
                basePath: '/api',
                version: true,
                versionOptions: {
                    type: VersionType.Uri,
                    defaultVersion: '1'
                } as any
            });

            const result = await generator.generate();

            expect(result[0].path).toBe('/api/v:version/users');
        });

        it('should not add the version parameter to the path for header versioning', async () => {
            setupMetadata(
                {
                    prefix: 'users'
                },
                [
                    {
                        target: TestController,
                        propertyKey: 'index',
                        method: 'GET',
                        path: '/'
                    }
                ]
            );

            const generator = createGenerator({
                basePath: '/api',
                version: true,
                versionOptions: {
                    type: VersionType.Header
                } as any
            });

            const result = await generator.generate();

            expect(result[0].path).toBe('/api/users');
        });
    });

    describe('version route grouping', () => {
        it('should group routes with the same HTTP method and path', async () => {
            setupMetadata(
                {
                    prefix: 'users'
                },
                [
                    {
                        target: TestController,
                        propertyKey: 'v1',
                        method: 'GET',
                        path: '/',
                        version: '1'
                    },
                    {
                        target: TestController,
                        propertyKey: 'v2',
                        method: 'GET',
                        path: '/',
                        version: '2'
                    }
                ]
            );

            const generator = createGenerator({
                version: true,
                versionOptions: {
                    type: VersionType.Header
                } as any
            });

            const result = await generator.generate();

            expect(result).toHaveLength(1);
            expect(result[0].versions).toEqual(['1', '2']);
        });

        it('should not group routes with different HTTP methods', async () => {
            setupMetadata(
                {
                    prefix: 'users'
                },
                [
                    {
                        target: TestController,
                        propertyKey: 'get',
                        method: 'GET',
                        path: '/',
                        version: '1'
                    },
                    {
                        target: TestController,
                        propertyKey: 'post',
                        method: 'POST',
                        path: '/',
                        version: '2'
                    }
                ]
            );

            const generator = createGenerator({
                version: true,
                versionOptions: {
                    type: VersionType.Header
                } as any
            });

            const result = await generator.generate();

            expect(result).toHaveLength(2);
            expect(result[0].httpMethod).toBe('GET');
            expect(result[1].httpMethod).toBe('POST');
        });

        it('should not group routes with different paths', async () => {
            setupMetadata(
                {
                    prefix: 'users'
                },
                [
                    {
                        target: TestController,
                        propertyKey: 'index',
                        method: 'GET',
                        path: '/users',
                        version: '1'
                    },
                    {
                        target: TestController,
                        propertyKey: 'detail',
                        method: 'GET',
                        path: '/users/:id',
                        version: '2'
                    }
                ]
            );

            const generator = createGenerator({
                version: true,
                versionOptions: {
                    type: VersionType.Header
                } as any
            });

            const result = await generator.generate();

            expect(result).toHaveLength(2);
        });

        it('should merge all versions from routes in the same group', async () => {
            setupMetadata(
                {
                    prefix: 'users'
                },
                [
                    {
                        target: TestController,
                        propertyKey: 'v1',
                        method: 'GET',
                        path: '/',
                        version: ['1', '2']
                    },
                    {
                        target: TestController,
                        propertyKey: 'v3',
                        method: 'GET',
                        path: '/',
                        version: ['3', '4']
                    }
                ]
            );

            const generator = createGenerator({
                version: true,
                versionOptions: {
                    type: VersionType.Header
                } as any
            });

            const result = await generator.generate();

            expect(result).toHaveLength(1);
            expect(result[0].versions).toEqual(['1', '2', '3', '4']);
        });
    });

    describe('route handler', () => {
        it('should execute the original route through httpEngine when versioning is disabled', async () => {
            const routeMetadata = {
                target: TestController,
                propertyKey: 'index',
                method: 'GET',
                path: '/'
            };

            setupMetadata(
                {
                    prefix: 'users'
                },
                [routeMetadata]
            );

            const generator = createGenerator({
                version: false
            });

            httpEngine.execute.mockResolvedValue(undefined);

            const result = await generator.generate();

            const context = {
                request: request,
                response: {},
                session: {}
            };

            await result[0].handler(context as any);

            expect(httpEngine.execute).toHaveBeenCalledTimes(1);

            const generatedContext = httpEngine.execute.mock.calls[0][0];

            expect(generatedContext).toEqual(
                expect.objectContaining({
                    request: context.request,
                    response: context.response,
                    session: context.session,
                    target: TestController,
                    propertyKey: 'index',
                    transport: ExecutionTransport.Http,
                    version: undefined,
                    error: undefined
                })
            );

            expect(scopedContainerManager.create).toHaveBeenCalledTimes(1);
        });
    });

    describe('version route handler', () => {
        it('should use versionMapping for grouped routes', async () => {
            setupMetadata(
                {
                    prefix: 'users'
                },
                [
                    {
                        target: TestController,
                        propertyKey: 'v1',
                        method: 'GET',
                        path: '/',
                        version: '1'
                    },
                    {
                        target: TestController,
                        propertyKey: 'v2',
                        method: 'GET',
                        path: '/',
                        version: '2'
                    }
                ]
            );

            const generator = createGenerator({
                version: true,
                versionOptions: {
                    type: VersionType.Header
                } as any
            });

            httpEngine.versionMapping.mockResolvedValue(undefined);

            const result = await generator.generate();

            expect(result).toHaveLength(1);

            const context = {
                request,
                response: {},
                session: {}
            };

            await result[0].handler(context as any);

            expect(httpEngine.versionMapping).toHaveBeenCalledTimes(1);

            const [routes, generatedContext] = httpEngine.versionMapping.mock.calls[0];

            expect(routes).toHaveLength(2);
            expect(generatedContext).toBe(context);
        });
    });

    describe('metadata', () => {
        it('should retrieve controllers using controller metadata', async () => {
            const generator = createGenerator();

            await generator.generate();

            expect(ClassRegistry.getWithMetadata).toHaveBeenCalledWith(MetadataKeys.CONTROLLER);
        });

        it('should retrieve controller metadata using the controller', async () => {
            setupMetadata(
                {
                    prefix: 'users'
                },
                []
            );

            const generator = createGenerator();

            await generator.generate();

            expect(Metadata.get).toHaveBeenNthCalledWith(1, MetadataKeys.CONTROLLER, TestController);
        });

        it('should retrieve route metadata using the controller', async () => {
            setupMetadata(
                {
                    prefix: 'users'
                },
                []
            );

            const generator = createGenerator();

            await generator.generate();

            expect(Metadata.get).toHaveBeenNthCalledWith(2, MetadataKeys.ROUTE, TestController);
        });

        it('should use an empty route metadata array when route metadata is undefined', async () => {
            (ClassRegistry.getWithMetadata as jest.Mock).mockReturnValue([TestController]);

            (Metadata.get as jest.Mock)
                .mockReturnValueOnce({
                    prefix: 'users'
                })
                .mockReturnValueOnce(undefined);

            const generator = createGenerator();

            const result = await generator.generate();

            expect(result).toEqual([]);
        });
    });
});
