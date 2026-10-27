import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { ClassRegistry } from '@axisparkjs/di';
import { RouteGenerator } from './route-generator';
import { RouteDefinition } from './route-definition';
import { VersionType } from '../version';
import { HttpPluginOptions } from '../plugin/http-plugin-options';

describe('RouteGenerator', () => {
    const httpEngine = { execute: jest.fn() };

    const createGenerator = (options: Partial<HttpPluginOptions> = {}) =>
        new RouteGenerator(
            httpEngine as any,
            {
                adapter: class TestAdapter {},
                port: 3000,
                basePath: '',
                version: false,
                ...options
            } as HttpPluginOptions
        );

    const setupControllers = (controllers: { target: any; metadata: Record<string, unknown>; routes: Record<string, unknown>[] }[]) => {
        (ClassRegistry as any).getWithMetadata = jest.fn().mockReturnValue(controllers.map(({ target }) => target));
        jest.spyOn(Metadata, 'get').mockImplementation(((key: unknown, target: object) => {
            const controller = controllers.find((item) => item.target === target);
            if (!controller) return undefined;
            return key === MetadataKeys.CONTROLLER ? controller.metadata : controller.routes;
        }) as any);
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (ClassRegistry as any).getWithMetadata = jest.fn().mockReturnValue([]);
        jest.restoreAllMocks();
    });

    it('returns no definitions when no controllers are registered', async () => {
        expect(await createGenerator().generate()).toEqual([]);
        expect(jest.spyOn(Metadata, 'get')).not.toHaveBeenCalled();
    });

    it('builds a route from the controller path and route path', async () => {
        class UsersController {}
        setupControllers([
            {
                target: UsersController,
                metadata: { path: '/users/' },
                routes: [{ target: UsersController, propertyKey: 'list', method: 'GET', path: '/list/' }]
            }
        ]);

        const [route] = await createGenerator({ basePath: '///api///' }).generate();

        expect(route.path).toBe('/api/users/list');
        expect(route.target).toBe(UsersController);
        expect(route.propertyKey).toBe('list');
    });

    it('builds the root path when controller and route paths are empty', async () => {
        class RootController {}
        setupControllers([
            { target: RootController, metadata: { path: '' }, routes: [{ target: RootController, propertyKey: 'index', method: 'GET', path: '/' }] }
        ]);

        const [route] = await createGenerator().generate();

        expect(route.path).toBe('/');
    });

    it('uses the global host wildcard when a controller has no host restriction', async () => {
        class PublicController {}
        setupControllers([
            { target: PublicController, metadata: { path: 'public' }, routes: [{ target: PublicController, propertyKey: 'index', method: 'GET', path: '/' }] }
        ]);

        const [route] = await createGenerator().generate();

        expect(route.hosts).toEqual(['*']);
    });

    it('copies an explicit host pattern to the generated route', async () => {
        class AdminController {}
        setupControllers([
            {
                target: AdminController,
                metadata: { path: 'admin', host: ['admin.example.com', '*.admin.example.com'] },
                routes: [{ target: AdminController, propertyKey: 'index', method: 'GET', path: '/' }]
            }
        ]);

        const [route] = await createGenerator().generate();

        expect(route.hosts).toEqual(['admin.example.com', '*.admin.example.com']);
    });

    it('uses no route versions when versioning is disabled', async () => {
        class VersionController {}
        setupControllers([
            {
                target: VersionController,
                metadata: { path: 'versions', version: '1' },
                routes: [{ target: VersionController, propertyKey: 'index', method: 'GET', path: '/', version: '2' }]
            }
        ]);

        const [route] = await createGenerator({ version: false }).generate();

        expect(route.versions).toEqual([]);
    });

    it('prefers a method version over its controller version', async () => {
        class VersionController {}
        setupControllers([
            {
                target: VersionController,
                metadata: { path: 'versions', version: '1' },
                routes: [{ target: VersionController, propertyKey: 'index', method: 'GET', path: '/', version: '2' }]
            }
        ]);

        const [route] = await createGenerator({ version: true }).generate();

        expect(route.versions).toEqual(['2']);
    });

    it('uses the controller version, then a wildcard default when no version is specified', async () => {
        class VersionController {}
        setupControllers([
            {
                target: VersionController,
                metadata: { path: 'versions', version: ['1', '2'] },
                routes: [{ target: VersionController, propertyKey: 'index', method: 'GET', path: '/' }]
            }
        ]);

        const [controllerVersionRoute] = await createGenerator({ version: true }).generate();
        expect(controllerVersionRoute.versions).toEqual(['1', '2']);

        setupControllers([
            {
                target: VersionController,
                metadata: { path: 'versions' },
                routes: [{ target: VersionController, propertyKey: 'index', method: 'GET', path: '/' }]
            }
        ]);
        const [wildcardRoute] = await createGenerator({ version: true }).generate();
        expect(wildcardRoute.versions).toEqual(['*']);
    });

    it('adds a version parameter to the path for URI versioning', async () => {
        class VersionController {}
        setupControllers([
            { target: VersionController, metadata: { path: 'users' }, routes: [{ target: VersionController, propertyKey: 'index', method: 'GET', path: '/' }] }
        ]);

        const [route] = await createGenerator({
            basePath: '/api',
            version: true,
            versionOptions: { type: VersionType.Uri }
        }).generate();

        expect(route.path).toBe('/api/v:version/users');
    });

    it('groups same-method and same-path routes as candidates for framework dispatch', async () => {
        class AdminController {}
        class ApiController {}
        setupControllers([
            {
                target: AdminController,
                metadata: { path: 'users', host: 'admin.example.com' },
                routes: [{ target: AdminController, propertyKey: 'adminIndex', method: 'GET', path: '/', version: '1' }]
            },
            {
                target: ApiController,
                metadata: { path: 'users', host: 'api.example.com' },
                routes: [{ target: ApiController, propertyKey: 'apiIndex', method: 'GET', path: '/', version: '2' }]
            }
        ]);

        const [dispatchRoute] = await createGenerator({ version: true }).generate();
        const context = { request: {}, response: {}, session: undefined } as any;

        expect(dispatchRoute).toBeInstanceOf(RouteDefinition);
        expect(dispatchRoute.path).toBe('/users');
        await dispatchRoute.handler(context);

        expect(httpEngine.execute).toHaveBeenCalledTimes(1);
        const [receivedContext, candidates] = httpEngine.execute.mock.calls[0];
        expect(receivedContext).toBe(context);
        expect(candidates).toHaveLength(2);
        expect(candidates.map((candidate: RouteDefinition) => [candidate.target, candidate.propertyKey, candidate.hosts, candidate.versions])).toEqual([
            [AdminController, 'adminIndex', ['admin.example.com'], ['1']],
            [ApiController, 'apiIndex', ['api.example.com'], ['2']]
        ]);
    });

    it('keeps routes with different methods or paths in separate dispatch definitions', async () => {
        class UsersController {}
        setupControllers([
            {
                target: UsersController,
                metadata: { path: 'users' },
                routes: [
                    { target: UsersController, propertyKey: 'list', method: 'GET', path: '/' },
                    { target: UsersController, propertyKey: 'create', method: 'POST', path: '/' },
                    { target: UsersController, propertyKey: 'detail', method: 'GET', path: '/:id' }
                ]
            }
        ]);

        const routes = await createGenerator().generate();

        expect(routes).toHaveLength(3);
        expect(routes.map(({ httpMethod, path }) => [httpMethod, path])).toEqual([
            ['GET', '/users'],
            ['POST', '/users'],
            ['GET', '/users/:id']
        ]);
    });
});
