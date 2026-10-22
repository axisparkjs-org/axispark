import { ExecutionTransport, ExecutionEngine } from '@axisparkjs/engine';
import { HttpEngine } from './http-engine';
import { HttpContext } from '../types';
import { VersionDefinition, VersionMatcher, VersionProcessor } from '../version';
import { RouteDefinition } from '../routes';
import { HostDefinition, HostMatcher, HostProcessor } from '../host';

describe('HttpEngine', () => {
    let httpEngine: HttpEngine;
    let executionEngine: jest.Mocked<ExecutionEngine>;
    let hostProcessor: jest.Mocked<HostProcessor>;
    let versionProcessor: jest.Mocked<VersionProcessor>;
    let hostMatcher: jest.Mocked<HostMatcher>;
    let versionMatcher: jest.Mocked<VersionMatcher>;
    let scopedContainerManager: { create: jest.Mock };

    class UsersController {}
    class AdminController {}

    const createContext = (): Pick<HttpContext, 'request' | 'response' | 'session'> => ({
        request: {} as any,
        response: {} as any,
        session: {} as any
    });

    const createRoute = (target: any, propertyKey: string, versions: string[] = ['*'], hosts: string[] = ['*']) =>
        ({ target, propertyKey, versions, hosts, httpMethod: 'GET', path: '/users' }) as unknown as RouteDefinition;

    beforeEach(() => {
        executionEngine = { execute: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<ExecutionEngine>;
        hostProcessor = { process: jest.fn() } as unknown as jest.Mocked<HostProcessor>;
        versionProcessor = { process: jest.fn() } as unknown as jest.Mocked<VersionProcessor>;
        hostMatcher = { match: jest.fn() } as unknown as jest.Mocked<HostMatcher>;
        versionMatcher = { match: jest.fn() } as unknown as jest.Mocked<VersionMatcher>;
        scopedContainerManager = { create: jest.fn().mockReturnValue({ scoped: true }) };

        httpEngine = new HttpEngine(executionEngine, hostProcessor, versionProcessor, hostMatcher, versionMatcher, scopedContainerManager as any);
    });

    describe('execute', () => {
        it('should process host and version definitions using the original context', async () => {
            const context = createContext();
            const route = createRoute(UsersController, 'list');
            hostMatcher.match.mockReturnValue([route]);
            versionMatcher.match.mockReturnValue(route);

            await httpEngine.execute(context, [route]);

            expect(hostProcessor.process).toHaveBeenCalledWith(expect.any(HostDefinition), context);
            expect(versionProcessor.process).toHaveBeenCalledWith(expect.any(VersionDefinition), context);
        });

        it('should match hosts first and then versions among the host-matched routes', async () => {
            const context = createContext();
            const adminRoute = createRoute(AdminController, 'list', ['*'], ['admin.example.com']);
            const usersRoute = createRoute(UsersController, 'list');
            const hostRoutes = [adminRoute];
            hostMatcher.match.mockReturnValue(hostRoutes);
            versionMatcher.match.mockReturnValue(adminRoute);

            await httpEngine.execute(context, [adminRoute, usersRoute]);

            const [hostMatcherRoutes, hostDefinition] = hostMatcher.match.mock.calls[0];
            expect(hostMatcherRoutes).toEqual([adminRoute, usersRoute]);
            expect(hostDefinition).toBeInstanceOf(HostDefinition);

            const [versionMatcherRoutes, versionDefinition] = versionMatcher.match.mock.calls[0];
            expect(versionMatcherRoutes).toBe(hostRoutes);
            expect(versionDefinition).toBeInstanceOf(VersionDefinition);
        });

        it('should fill the context with the selected route and accepted hosts and versions', async () => {
            const context = createContext();
            const route = createRoute(AdminController, 'list', ['1', '2'], ['admin.example.com']);
            hostMatcher.match.mockReturnValue([route]);
            versionMatcher.match.mockReturnValue(route);

            hostProcessor.process.mockImplementation((host) => host?.setHost('admin.example.com'));
            versionProcessor.process.mockImplementation((version) => version?.setVersion('2'));

            await httpEngine.execute(context, [route]);

            expect(executionEngine.execute).toHaveBeenCalledTimes(1);
            const filledContext = executionEngine.execute.mock.calls[0][0] as HttpContext;
            expect(filledContext).toMatchObject({
                request: context.request,
                response: context.response,
                session: context.session,
                scopedContainer: { scoped: true },
                transport: ExecutionTransport.Http,
                target: AdminController,
                propertyKey: 'list',
                error: undefined
            });
            expect(filledContext.host?.host).toBe('admin.example.com');
            expect(filledContext.host?.isHostAccepted()).toBe(true);
            expect(filledContext.version?.version).toBe('2');
            expect(filledContext.version?.isVersionAccepted()).toBe(true);
        });

        it('should mark the host and version as not accepted when they do not match the route', async () => {
            const route = createRoute(AdminController, 'list', ['1'], ['admin.example.com']);
            hostMatcher.match.mockReturnValue([route]);
            versionMatcher.match.mockReturnValue(route);
            hostProcessor.process.mockImplementation((host) => host?.setHost('api.example.com'));
            versionProcessor.process.mockImplementation((version) => version?.setVersion('2'));

            await httpEngine.execute(createContext(), [route]);

            const filledContext = executionEngine.execute.mock.calls[0][0] as HttpContext;
            expect(filledContext.host?.isHostAccepted()).toBe(false);
            expect(filledContext.version?.isVersionAccepted()).toBe(false);
        });

        it('should create a scoped container for each execution', async () => {
            const route = createRoute(UsersController, 'list');
            hostMatcher.match.mockReturnValue([route]);
            versionMatcher.match.mockReturnValue(route);

            await httpEngine.execute(createContext(), [route]);
            await httpEngine.execute(createContext(), [route]);

            expect(scopedContainerManager.create).toHaveBeenCalledTimes(2);
        });

        it('should execute in the order process, match and execute', async () => {
            const route = createRoute(UsersController, 'list');
            const calls: string[] = [];
            hostProcessor.process.mockImplementation(() => void calls.push('process-host'));
            versionProcessor.process.mockImplementation(() => void calls.push('process-version'));
            hostMatcher.match.mockImplementation(() => {
                calls.push('match-host');
                return [route];
            });
            versionMatcher.match.mockImplementation(() => {
                calls.push('match-version');
                return route;
            });
            executionEngine.execute.mockImplementation(async () => void calls.push('execute'));

            await httpEngine.execute(createContext(), [route]);

            expect(calls).toEqual(['process-host', 'process-version', 'match-host', 'match-version', 'execute']);
        });

        it('should propagate an error when host processing fails', async () => {
            const error = new Error('Host processing failed');
            hostProcessor.process.mockImplementation(() => {
                throw error;
            });

            await expect(httpEngine.execute(createContext(), [])).rejects.toThrow(error);

            expect(versionProcessor.process).not.toHaveBeenCalled();
            expect(executionEngine.execute).not.toHaveBeenCalled();
        });

        it('should propagate an error when version processing fails', async () => {
            const error = new Error('Version processing failed');
            versionProcessor.process.mockImplementation(() => {
                throw error;
            });

            await expect(httpEngine.execute(createContext(), [])).rejects.toThrow(error);

            expect(hostMatcher.match).not.toHaveBeenCalled();
            expect(executionEngine.execute).not.toHaveBeenCalled();
        });

        it('should propagate an error when route matching fails', async () => {
            const error = new Error('No route');
            hostMatcher.match.mockImplementation(() => {
                throw error;
            });

            await expect(httpEngine.execute(createContext(), [])).rejects.toThrow(error);

            expect(versionMatcher.match).not.toHaveBeenCalled();
            expect(executionEngine.execute).not.toHaveBeenCalled();
        });

        it('should propagate an error when execution fails', async () => {
            const error = new Error('Execution failed');
            const route = createRoute(UsersController, 'list');
            hostMatcher.match.mockReturnValue([route]);
            versionMatcher.match.mockReturnValue(route);
            executionEngine.execute.mockRejectedValue(error);

            await expect(httpEngine.execute(createContext(), [route])).rejects.toThrow(error);
        });
    });
});
