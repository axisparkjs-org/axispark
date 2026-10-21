import fastify from 'fastify';
import cookie from '@fastify/cookie';
import session from '@fastify/session';
import compress from '@fastify/compress';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import fastifyStatic from '@fastify/static';

import { HttpMethod, RouteDefinition } from '@axisparkjs/http';

import { FastifyHttpAdapter } from './fastify-http-adapter';
import { FastifyHttpRequest } from '../types/fastify-http-request';
import { FastifyHttpResponse } from '../types/fastify-http-response';
import { FastifyHttpSession } from '../types/fastify-http-session';
import { FastifyHttpPluginOptions } from '../plugin';

jest.mock('fastify', () => {
    const server = {
        listen: jest.fn(),
        close: jest.fn()
    };
    const app = {
        register: jest.fn().mockResolvedValue(undefined),
        route: jest.fn(),
        listen: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
        server
    };

    return Object.assign(
        jest.fn(() => app),
        {
            __app: app,
            __server: server
        }
    );
});

const route = (target: any, path: string, handler: jest.Mock, propertyKey: string): RouteDefinition =>
    new RouteDefinition(target, propertyKey, HttpMethod.Get, path, ['v1', 'v2'], handler);

jest.mock('@fastify/static', () => jest.fn());
jest.mock('@fastify/cookie', () => jest.fn());
jest.mock('@fastify/session', () => jest.fn());
jest.mock('@fastify/compress', () => jest.fn());
jest.mock('@fastify/cors', () => jest.fn());
jest.mock('@fastify/formbody', () => jest.fn());

describe('FastifyHttpAdapter', () => {
    const app = (fastify as any).__app;

    const baseConfig = {
        port: 8080,
        plugin: {} as never,
        adapter: {} as never,
        basePath: '/',
        bodyParser: false,
        urlEncoded: false,
        urlEncodedOptions: {},
        cors: false,
        corsOptions: {},
        session: false,
        sessionOptions: { secret: 'secret' },
        cookies: false,
        cookiesOptions: {},
        compression: false,
        compressionOptions: {},
        healthChecks: false,
        timeout: false,
        timeoutOptions: undefined,
        rateLimit: false,
        rateLimitOptions: undefined,
        version: false,
        versionOptions: undefined,
        logErrors: false,
        logHttpErrors: false,
        logHttpRequests: false,
        logHttpResponses: false
    } as FastifyHttpPluginOptions;

    const axisparkConfig = {
        basePath: '/app'
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('initialize', () => {
        it('should register all enabled plugins', async () => {
            const adapter = new FastifyHttpAdapter(
                {
                    ...baseConfig,
                    cookies: true,
                    session: true,
                    compression: true,
                    cors: true,
                    urlEncoded: true
                },
                axisparkConfig as any
            );

            await adapter.initialize();

            expect(app.register).toHaveBeenCalledWith(
                fastifyStatic,
                expect.objectContaining({
                    root: expect.stringContaining('public')
                })
            );

            expect(app.register).toHaveBeenCalledWith(cookie, {});
            expect(app.register).toHaveBeenCalledWith(session, {
                secret: 'secret'
            });
            expect(app.register).toHaveBeenCalledWith(compress, {});
            expect(app.register).toHaveBeenCalledWith(cors, {});
            expect(app.register).toHaveBeenCalledWith(formbody, {});
        });

        it('should register all enabled plugins and use the default options', async () => {
            const adapter = new FastifyHttpAdapter(
                {
                    ...baseConfig,
                    cookies: true,
                    cookiesOptions: undefined,
                    session: true,
                    sessionOptions: { secret: 'secret' },
                    compression: true,
                    compressionOptions: undefined,
                    cors: true,
                    corsOptions: undefined,
                    urlEncoded: true,
                    urlEncodedOptions: undefined
                },
                axisparkConfig as any
            );

            await adapter.initialize();

            expect(app.register).toHaveBeenCalledWith(
                fastifyStatic,
                expect.objectContaining({
                    root: expect.stringContaining('public')
                })
            );

            expect(app.register).toHaveBeenCalledWith(cookie, {});
            expect(app.register).toHaveBeenCalledWith(session, {
                secret: 'secret'
            });
            expect(app.register).toHaveBeenCalledWith(compress, {});
            expect(app.register).toHaveBeenCalledWith(cors, {});
            expect(app.register).toHaveBeenCalledWith(formbody, {});
        });

        it('should only register static when everything is disabled', async () => {
            const adapter = new FastifyHttpAdapter(baseConfig, {} as any);

            await adapter.initialize();

            expect(app.register).toHaveBeenCalledTimes(1);
            expect(app.register).toHaveBeenCalledWith(fastifyStatic, expect.any(Object));
        });
    });

    describe('registerRoutes', () => {
        it('should register every route', () => {
            const adapter = new FastifyHttpAdapter(baseConfig, axisparkConfig as any);

            const handler = jest.fn();

            adapter.registerRoutes([route(class {}, '/users', handler, 'getUsers')]);

            expect(app.route).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'GET',
                    url: '/users',
                    handler: expect.any(Function)
                })
            );
        });

        it('should create the http context', async () => {
            const adapter = new FastifyHttpAdapter(baseConfig, axisparkConfig as any);

            const handler = jest.fn();

            adapter.registerRoutes([route(class {}, '/', handler, 'test')]);

            const callback = app.route.mock.calls[0][0].handler;

            await callback({}, {});

            expect(handler).toHaveBeenCalledWith({
                request: expect.any(FastifyHttpRequest),
                response: expect.any(FastifyHttpResponse),
                session: undefined
            });
        });

        it('should include session when available', async () => {
            const adapter = new FastifyHttpAdapter(
                {
                    ...baseConfig,
                    session: true
                },
                axisparkConfig as any
            );

            const handler = jest.fn();

            adapter.registerRoutes([route(class {}, '/', handler, 'test')]);

            const callback = app.route.mock.calls[0][0].handler;

            await callback(
                {
                    session: {}
                },
                {}
            );

            expect(handler).toHaveBeenCalledWith({
                request: expect.any(FastifyHttpRequest),
                response: expect.any(FastifyHttpResponse),
                session: expect.any(FastifyHttpSession)
            });
        });
    });

    describe('getRegisteredRoutes', () => {
        it('should return all registered routes', () => {
            const adapter = new FastifyHttpAdapter(baseConfig, axisparkConfig as any);

            const handler = jest.fn();

            const routes = [route(class {}, '/users', handler, 'getUsers')];

            adapter.registerRoutes(routes);

            expect(adapter.getRegisteredRoutes()).toEqual(routes);
        });
    });

    describe('getHttpServer', () => {
        it('should return the underlying http server', () => {
            const adapter = new FastifyHttpAdapter(baseConfig, axisparkConfig as any);
            const server = (fastify as any).__server;

            expect(adapter.getHttpServer()).toBe(server);
        });
    });

    describe('start', () => {
        it('should listen on configured port', async () => {
            const adapter = new FastifyHttpAdapter(baseConfig, axisparkConfig as any);

            await adapter.start();

            expect(app.listen).toHaveBeenCalledWith({
                port: 8080
            });
        });
    });

    describe('stop', () => {
        it('should close the server', async () => {
            const adapter = new FastifyHttpAdapter(baseConfig, axisparkConfig as any);

            await adapter.stop();

            expect(app.close).toHaveBeenCalled();
        });
    });
});
