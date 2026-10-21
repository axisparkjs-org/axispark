import express from 'express';
import session from 'express-session';
import { ExpressHttpAdapter } from './express-http-adapter';
import { ExpressHttpRequest } from '../types/express-http-request';
import { ExpressHttpResponse } from '../types/express-http-response';
import { ExpressHttpSession } from '../types/express-http-session';
import { HttpMethod, RouteDefinition } from '@axisparkjs/http';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import cors from 'cors';
import { createServer } from 'node:http';

const mockServer = {
    listen: jest.fn(),
    close: jest.fn()
};

jest.mock('node:http', () => ({
    createServer: jest.fn(() => mockServer)
}));

jest.mock('express', () => {
    const app = {
        use: jest.fn(),
        get: jest.fn(),
        post: jest.fn(),
        put: jest.fn(),
        patch: jest.fn(),
        delete: jest.fn(),
        listen: jest.fn()
    };

    return Object.assign(
        jest.fn(() => app),
        {
            json: jest.fn(() => 'json-middleware'),
            urlencoded: jest.fn(() => 'urlencoded-middleware')
        }
    );
});

jest.mock('express-session', () => jest.fn(() => 'session-middleware'));
jest.mock('cookie-parser', () => jest.fn(() => 'cookie-parser-middleware'));
jest.mock('compression', () => jest.fn(() => 'compression-middleware'));
jest.mock('cors', () => jest.fn(() => 'cors-middleware'));

const route = (target: any, path: string, handler: jest.Mock, propertyKey: string): RouteDefinition =>
    new RouteDefinition(target, propertyKey, HttpMethod.Get, path, ['v1', 'v2'], handler);

describe('ExpressHttpAdapter', () => {
    const app = (express as unknown as jest.Mock)();
    const baseConfig = {
        port: 8080,
        basePath: '/',
        plugin: {} as never,
        adapter: {} as never,
        bodyParser: false,
        bodyParserOptions: {},
        urlEncoded: false,
        urlEncodedOptions: {},
        cors: false,
        session: false,
        cookies: false,
        compression: false,
        timeout: false,
        rateLimit: false,
        rateLimitOptions: undefined,
        logErrors: false,
        logHttpErrors: false,
        logHttpRequests: false,
        logHttpResponses: false,
        version: true
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('initialize', () => {
        it('should create http server and register all enabled middlewares', async () => {
            const adapter = new ExpressHttpAdapter({
                ...baseConfig,
                bodyParser: true,
                bodyParserOptions: { limit: '10mb' },
                urlEncoded: true,
                urlEncodedOptions: { extended: false },
                cors: true,
                corsOptions: { origin: 'http://example.com' },
                session: true,
                sessionOptions: { secret: 'secret' },
                cookies: true,
                cookiesOptions: { secret: 'secret', options: undefined },
                compression: true,
                compressionOptions: { threshold: 1024 }
            });

            await adapter.initialize();

            expect(createServer).toHaveBeenCalledWith(app);
            expect(express.json).toHaveBeenCalledWith({ limit: '10mb' });
            expect(express.urlencoded).toHaveBeenCalledWith({ extended: false });
            expect(session).toHaveBeenCalledWith({ secret: 'secret' });
            expect(cookieParser).toHaveBeenCalledWith('secret', undefined);
            expect(compression).toHaveBeenCalledWith({ threshold: 1024 });
            expect(cors).toHaveBeenCalledWith({ origin: 'http://example.com' });

            expect(app.use).toHaveBeenCalledTimes(6);
        });

        it('should not register disabled middlewares', async () => {
            const adapter = new ExpressHttpAdapter({
                ...baseConfig,
                bodyParser: false,
                urlEncoded: false,
                session: false,
                cookies: false,
                compression: false,
                cors: false
            });

            await adapter.initialize();

            expect(createServer).toHaveBeenCalledWith(app);
            expect(app.use).not.toHaveBeenCalled();
        });

        it('should register cookies without options', async () => {
            const adapter = new ExpressHttpAdapter({
                ...baseConfig,
                cookies: true
            });

            await adapter.initialize();

            expect(app.use).toHaveBeenCalled();
            expect(cookieParser).toHaveBeenCalledWith(undefined, undefined);
        });
    });

    describe('getHttpServer', () => {
        it('should return the underlying http server', async () => {
            const adapter = new ExpressHttpAdapter(baseConfig);
            await adapter.initialize();

            expect(adapter.getHttpServer()).toBe(mockServer);
        });
    });

    describe('registerRoutes', () => {
        it('should register every route', () => {
            const adapter = new ExpressHttpAdapter(baseConfig);

            const handler = jest.fn();

            adapter.registerRoutes([route(class TestController {}, '/users', handler, 'getUsers')]);

            expect(app.get).toHaveBeenCalledWith('/users', expect.any(Function));
        });

        it('should create the http context', async () => {
            const adapter = new ExpressHttpAdapter(baseConfig);

            const handler = jest.fn();

            adapter.registerRoutes([route(class TestController {}, '/', handler, 'test')]);

            const callback = app.get.mock.calls[0][1];

            const req = {};
            const res = {};

            await callback(req, res);

            expect(handler).toHaveBeenCalledWith({
                request: expect.any(ExpressHttpRequest),
                response: expect.any(ExpressHttpResponse),
                session: undefined
            });
        });

        it('should include session when available', async () => {
            const adapter = new ExpressHttpAdapter({
                ...baseConfig,
                session: true,
                sessionOptions: { secret: 'secret' }
            });

            const handler = jest.fn();

            adapter.registerRoutes([route(class TestController {}, '/', handler, 'test')]);

            const callback = app.get.mock.calls[0][1];

            await callback({ session: {} }, {});

            expect(handler).toHaveBeenCalledWith({
                request: expect.any(ExpressHttpRequest),
                response: expect.any(ExpressHttpResponse),
                session: expect.any(ExpressHttpSession)
            });
        });
    });

    describe('getRegisteredRoutes', () => {
        it('should return all registered routes', () => {
            const adapter = new ExpressHttpAdapter(baseConfig);

            const handler = jest.fn();

            const routes = [route(class TestController {}, '/users', handler, 'getUsers')];

            adapter.registerRoutes(routes);

            expect(adapter.getRegisteredRoutes()).toEqual(routes);
        });
    });

    describe('start', () => {
        it('should listen on configured port when initialized', async () => {
            const adapter = new ExpressHttpAdapter(baseConfig);
            await adapter.initialize();

            adapter.start();

            expect(mockServer.listen).toHaveBeenCalledWith(8080);
        });

        it('should do nothing when httpServer is not initialized', () => {
            const adapter = new ExpressHttpAdapter(baseConfig);

            expect(() => adapter.start()).not.toThrow();
            expect(mockServer.listen).not.toHaveBeenCalled();
        });
    });

    describe('stop', () => {
        it('should close the server when initialized', async () => {
            const adapter = new ExpressHttpAdapter(baseConfig);
            await adapter.initialize();

            adapter.stop();

            expect(mockServer.close).toHaveBeenCalled();
        });

        it('should do nothing when server has not been initialized', () => {
            const adapter = new ExpressHttpAdapter(baseConfig);

            expect(() => adapter.stop()).not.toThrow();
            expect(mockServer.close).not.toHaveBeenCalled();
        });
    });
});
