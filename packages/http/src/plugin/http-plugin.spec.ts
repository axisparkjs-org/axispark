import { PluginNotConfiguredError } from '@axisparkjs/core';
import { ClassRegistry, InjectableScopes, Injector } from '@axisparkjs/di';
import { HttpPlugin } from './http-plugin';
import { RouteGenerator } from '../routes/route-generator';
import { RouteDefinition } from '../routes/route-definition';
import { RouteValidator } from '../routes/route-validator';
import { HTTP_ADAPTER, HTTP_LOGGER, HTTP_OPTIONS } from '../di/tokens';
import { HttpPluginOptions } from './http-plugin-options';
import { HealthController, RateLimitGuard, VersionGuard } from '../implementations';
import { LogErrorFilter, LogHttpErrorFilter } from '../implementations/filters';
import { LogHttpRequestInterceptor, LogHttpResponseInterceptor } from '../implementations';
import { HttpRateLimitResolver, HttpResultResolver, HttpTimeoutResolver } from '../implementations';
import {
    ExecutionTransport,
    ParameterGenerator,
    RateLimitGenerator,
    RateLimitProcessor,
    ResultProcessor,
    TimeoutGenerator,
    TimeoutProcessor
} from '@axisparkjs/engine';
import { HttpParameter } from '../types';
import { VersionProcessor, VersionType } from '../version';
import { HttpMethod } from '../types';

jest.mock('../routes/route-generator');

jest.mock('@axisparkjs/di', () => ({
    ...jest.requireActual('@axisparkjs/di'),
    ClassRegistry: {
        remove: jest.fn()
    }
}));

jest.mock('@axisparkjs/engine', () => ({
    ...jest.requireActual('@axisparkjs/engine'),
    ResultProcessor: {
        registerResult: jest.fn()
    },
    TimeoutProcessor: {
        registerTimeout: jest.fn()
    },
    ParameterGenerator: {
        registerParameter: jest.fn()
    },
    TimeoutGenerator: {
        registerTimeout: jest.fn()
    },
    RateLimitProcessor: {
        registerRateLimit: jest.fn()
    },
    RateLimitGenerator: {
        registerRateLimit: jest.fn()
    }
}));

jest.mock('../version', () => ({
    VersionProcessor: {
        registerVersion: jest.fn()
    },
    VersionType: {
        Header: 'header',
        MediaType: 'media-type',
        Uri: 'uri'
    }
}));

describe('HttpPlugin', () => {
    let plugin: HttpPlugin;
    let logger: any;
    let injector: jest.Mocked<Injector>;
    let container: any;
    let adapter: any;
    let context: any;

    const Adapter = class TestAdapter {};
    const route = (target: any, method: HttpMethod, path: string, versions?: string[]) =>
        new RouteDefinition(target, 'handler', method, path, versions ?? [], ['*'], jest.fn());

    const options = {
        adapter: Adapter,
        port: 3000,
        healthChecks: true,
        logHttpRequests: true,
        logHttpResponses: true,
        logHttpErrors: true,
        logErrors: true,
        version: true,
        timeout: true,
        timeoutOptions: {
            time: 5000
        },
        rateLimit: false,
        rateLimitOptions: {
            ttl: 60_000,
            limit: 100
        }
    } as HttpPluginOptions;

    const optionsWithoutComponents = {
        adapter: Adapter,
        port: 3000
    } as HttpPluginOptions;

    beforeEach(() => {
        jest.clearAllMocks();

        logger = {
            child: jest.fn(),
            info: jest.fn().mockResolvedValue(undefined),
            debug: jest.fn().mockResolvedValue(undefined)
        };

        logger.child.mockReturnValue(logger);

        adapter = {
            registerRoutes: jest.fn().mockResolvedValue(undefined),
            start: jest.fn().mockResolvedValue(undefined),
            stop: jest.fn().mockResolvedValue(undefined),
            initialize: jest.fn().mockResolvedValue(undefined)
        };

        container = {
            resolve: jest.fn(),
            bind: jest.fn(),
            unbind: jest.fn()
        };

        context = {
            container
        };

        injector = {
            get: jest.fn()
        } as unknown as jest.Mocked<Injector>;

        injector.get.mockImplementation(async (target: any) => {
            if (target === RouteGenerator) {
                return {
                    generate: jest.fn().mockResolvedValue([])
                };
            }

            return { validate: jest.fn() };
        });

        container.resolve.mockImplementation((token: any) => {
            if (token === HTTP_ADAPTER) {
                return adapter;
            }

            return undefined;
        });

        plugin = new HttpPlugin(logger, injector);
    });

    describe('onRegister', () => {
        it('should throw when options are not provided', async () => {
            await expect(plugin.onRegister(context)).rejects.toBeInstanceOf(PluginNotConfiguredError);
        });

        it('should register container bindings', async () => {
            await plugin.onRegister(context, options);

            expect(container.bind).toHaveBeenCalledWith({
                token: HTTP_OPTIONS,
                useValue: options
            });

            expect(container.bind).toHaveBeenCalledWith({
                token: HTTP_ADAPTER,
                useClass: options.adapter,
                scope: InjectableScopes.Singleton
            });

            expect(container.bind).toHaveBeenCalledWith({
                token: HTTP_LOGGER,
                useValue: logger
            });
        });

        it('should initialize the adapter', async () => {
            await plugin.onRegister(context, options);

            expect(adapter.initialize).toHaveBeenCalledTimes(1);
        });

        it('should register generated routes', async () => {
            const routes = [route(class UsersController {}, HttpMethod.Get, '/users'), route(class UsersController {}, HttpMethod.Post, '/users')];

            const generate = jest.fn().mockResolvedValue(routes);

            injector.get.mockImplementation(async (target: any) => {
                if (target === RouteGenerator) {
                    return { generate };
                }

                return { validate: jest.fn() };
            });

            await plugin.onRegister(context, options);

            expect(generate).toHaveBeenCalledTimes(1);
            expect(adapter.registerRoutes).toHaveBeenCalledWith(routes);
        });

        it('should validate the generated routes before initializing the adapter', async () => {
            const routes = [route(class UsersController {}, HttpMethod.Get, '/users')];
            const calls: string[] = [];
            const validate = jest.fn().mockImplementation(async () => void calls.push('validate'));
            adapter.initialize.mockImplementation(async () => void calls.push('initialize'));
            injector.get.mockImplementation(async (target: any) => {
                if (target === RouteGenerator) return { generate: jest.fn().mockResolvedValue(routes) };
                if (target === RouteValidator) return { validate };
                return { validate: jest.fn() };
            });

            await plugin.onRegister(context, options);

            expect(validate).toHaveBeenCalledWith(routes);
            expect(calls).toEqual(['validate', 'initialize']);
        });

        it('should stop before adapter initialization when route validation fails', async () => {
            const error = new Error('HTTP route validation failed');
            injector.get.mockImplementation(async (target: any) => {
                if (target === RouteGenerator) return { generate: jest.fn().mockResolvedValue([]) };
                if (target === RouteValidator) return { validate: jest.fn().mockRejectedValue(error) };
                return { validate: jest.fn() };
            });

            await expect(plugin.onRegister(context, options)).rejects.toThrow(error);

            expect(adapter.initialize).not.toHaveBeenCalled();
            expect(adapter.registerRoutes).not.toHaveBeenCalled();
        });

        it('should log every registered route', async () => {
            class UsersController {}

            const routes = [route(UsersController, HttpMethod.Get, '/users'), route(UsersController, HttpMethod.Post, '/users', ['1', '2'])];

            injector.get.mockImplementation(async (target: any) => {
                if (target === RouteGenerator) {
                    return {
                        generate: jest.fn().mockResolvedValue(routes)
                    };
                }

                return { validate: jest.fn() };
            });

            await plugin.onRegister(context, options);

            expect(logger.debug).toHaveBeenCalledWith('Registered route GET /users for controller UsersController');

            expect(logger.debug).toHaveBeenCalledWith('Registered route POST /users for controller UsersController with versions 1, 2');
        });

        it('should log each controller only once', async () => {
            class UsersController {}

            const routes = [route(UsersController, HttpMethod.Get, '/users'), route(UsersController, HttpMethod.Post, '/users')];

            injector.get.mockImplementation(async (target: any) => {
                if (target === RouteGenerator) {
                    return {
                        generate: jest.fn().mockResolvedValue(routes)
                    };
                }

                return { validate: jest.fn() };
            });

            await plugin.onRegister(context, options);

            expect(logger.info).toHaveBeenCalledWith('Registered controller UsersController');

            expect(logger.info.mock.calls.filter(([message]: [string]) => message === 'Registered controller UsersController')).toHaveLength(1);
        });

        it('should log plugin registration', async () => {
            await plugin.onRegister(context, options);

            expect(logger.info).toHaveBeenCalledWith('Plugin registered');
        });

        it('should support adapters without initialize', async () => {
            const adapterWithoutInitialize = {
                registerRoutes: jest.fn().mockResolvedValue(undefined),
                start: jest.fn().mockResolvedValue(undefined),
                stop: jest.fn().mockResolvedValue(undefined)
            };

            container.resolve.mockReturnValue(adapterWithoutInitialize);

            await plugin.onRegister(context, options);

            expect(adapterWithoutInitialize.registerRoutes).toHaveBeenCalled();

            expect(logger.info).toHaveBeenCalledWith('Plugin registered');
        });
    });

    describe('configureImplementations', () => {
        it('should keep all optional components when enabled', async () => {
            await plugin.onRegister(context, { ...options, rateLimit: true });

            expect(ClassRegistry.remove).not.toHaveBeenCalled();
            expect(container.unbind).not.toHaveBeenCalled();
        });

        it.each([
            ['healthChecks', HealthController],
            ['logHttpRequests', LogHttpRequestInterceptor],
            ['logHttpResponses', LogHttpResponseInterceptor],
            ['logHttpErrors', LogHttpErrorFilter],
            ['logErrors', LogErrorFilter],
            ['rateLimit', RateLimitGuard],
            ['version', VersionGuard]
        ])('should disable %s when it is not enabled', async (_option, target) => {
            await plugin.onRegister(context, optionsWithoutComponents);

            expect(ClassRegistry.remove).toHaveBeenCalledWith(target);

            expect(container.unbind).toHaveBeenCalledWith(target);
        });
    });

    describe('registerImplementations', () => {
        beforeEach(() => {
            injector.get.mockImplementation(async (target: any) => {
                return { target, validate: jest.fn() };
            });
        });

        it('should register the HTTP result resolver', async () => {
            const resolver = {};

            injector.get.mockImplementation(async (target: any) => {
                if (target === HttpResultResolver) {
                    return resolver;
                }

                return {
                    generate: jest.fn().mockResolvedValue([]),
                    validate: jest.fn()
                };
            });

            await plugin.onRegister(context, options);

            expect(injector.get).toHaveBeenCalledWith(HttpResultResolver);

            expect(ResultProcessor.registerResult).toHaveBeenCalledWith(ExecutionTransport.Http, resolver);
        });

        it('should register timeout processing when timeout is enabled', async () => {
            const timeoutProcessor = {};

            injector.get.mockImplementation(async (target: any) => {
                if (target === HttpTimeoutResolver) {
                    return timeoutProcessor;
                }

                return {
                    generate: jest.fn().mockResolvedValue([]),
                    validate: jest.fn()
                };
            });

            await plugin.onRegister(context, options);

            expect(injector.get).toHaveBeenCalledWith(HttpTimeoutResolver);

            expect(TimeoutProcessor.registerTimeout).toHaveBeenCalledWith(ExecutionTransport.Http, timeoutProcessor);

            expect(TimeoutGenerator.registerTimeout).toHaveBeenCalledWith(ExecutionTransport.Http, 5000);
        });

        it('should register timeout processing without time', async () => {
            const timeoutProcessor = {};

            injector.get.mockImplementation(async (target: any) => {
                if (target === HttpTimeoutResolver) {
                    return timeoutProcessor;
                }

                return {
                    generate: jest.fn().mockResolvedValue([]),
                    validate: jest.fn()
                };
            });

            await plugin.onRegister(context, {
                ...options,
                timeoutOptions: undefined
            });

            expect(injector.get).toHaveBeenCalledWith(HttpTimeoutResolver);

            expect(TimeoutProcessor.registerTimeout).toHaveBeenCalledWith(ExecutionTransport.Http, timeoutProcessor);

            expect(TimeoutGenerator.registerTimeout).toHaveBeenCalledWith(ExecutionTransport.Http, undefined);
        });

        it('should not register timeout when timeout is disabled', async () => {
            injector.get.mockResolvedValue({
                generate: jest.fn().mockResolvedValue([]),
                validate: jest.fn()
            });

            await plugin.onRegister(context, {
                ...options,
                timeout: false
            });

            expect(TimeoutProcessor.registerTimeout).not.toHaveBeenCalled();

            expect(TimeoutGenerator.registerTimeout).not.toHaveBeenCalled();
        });

        it('should register the rate limit generator and HTTP resolver when enabled', async () => {
            const resolver = {};
            injector.get.mockImplementation(async (target: any) => {
                if (target === HttpRateLimitResolver) return resolver;
                return { generate: jest.fn().mockResolvedValue([]), validate: jest.fn() };
            });

            await plugin.onRegister(context, { ...options, rateLimit: true });

            expect(RateLimitGenerator.registerRateLimit).toHaveBeenCalledWith(ExecutionTransport.Http, { ttl: 60_000, limit: 100 });
            expect(RateLimitProcessor.registerRateLimit).toHaveBeenCalledWith(ExecutionTransport.Http, resolver);
            expect(injector.get).toHaveBeenCalledWith(HttpRateLimitResolver);
        });

        it('clears the HTTP rate limit resolver and defaults when disabled', async () => {
            injector.get.mockResolvedValue({ generate: jest.fn().mockResolvedValue([]), validate: jest.fn() });

            await plugin.onRegister(context, { ...options, rateLimit: false });

            expect(RateLimitGenerator.registerRateLimit).toHaveBeenCalledWith(ExecutionTransport.Http);
            expect(RateLimitProcessor.registerRateLimit).toHaveBeenCalledWith(ExecutionTransport.Http);
            expect(injector.get).not.toHaveBeenCalledWith(HttpRateLimitResolver);
        });

        it('should register all HTTP parameter resolvers', async () => {
            injector.get.mockResolvedValue({
                generate: jest.fn().mockResolvedValue([]),
                validate: jest.fn()
            });

            await plugin.onRegister(context, options);

            expect(ParameterGenerator.registerParameter).toHaveBeenCalledWith(HttpParameter.Request, expect.anything());

            expect(ParameterGenerator.registerParameter).toHaveBeenCalledWith(HttpParameter.Response, expect.anything());

            expect(ParameterGenerator.registerParameter).toHaveBeenCalledWith(HttpParameter.Body, expect.anything());

            expect(ParameterGenerator.registerParameter).toHaveBeenCalledWith(HttpParameter.Path, expect.anything());

            expect(ParameterGenerator.registerParameter).toHaveBeenCalledWith(HttpParameter.Query, expect.anything());

            expect(ParameterGenerator.registerParameter).toHaveBeenCalledWith(HttpParameter.Header, expect.anything());

            expect(ParameterGenerator.registerParameter).toHaveBeenCalledWith(HttpParameter.Ip, expect.anything());

            expect(ParameterGenerator.registerParameter).toHaveBeenCalledWith(HttpParameter.Session, expect.anything());

            expect(ParameterGenerator.registerParameter).toHaveBeenCalledWith(HttpParameter.Cookie, expect.anything());

            expect(ParameterGenerator.registerParameter).toHaveBeenCalledTimes(9);
        });

        it('should register version resolvers when version is enabled', async () => {
            injector.get.mockResolvedValue({
                generate: jest.fn().mockResolvedValue([]),
                validate: jest.fn()
            });

            await plugin.onRegister(context, options);

            expect(VersionProcessor.registerVersion).toHaveBeenCalledWith(VersionType.Header, expect.anything());

            expect(VersionProcessor.registerVersion).toHaveBeenCalledWith(VersionType.MediaType, expect.anything());

            expect(VersionProcessor.registerVersion).toHaveBeenCalledWith(VersionType.Uri, expect.anything());

            expect(VersionProcessor.registerVersion).toHaveBeenCalledTimes(3);
        });

        it('should not register version resolvers when version is disabled', async () => {
            injector.get.mockResolvedValue({
                generate: jest.fn().mockResolvedValue([]),
                validate: jest.fn()
            });

            await plugin.onRegister(context, {
                ...options,
                version: false
            });

            expect(VersionProcessor.registerVersion).not.toHaveBeenCalled();
        });
    });

    describe('onStart', () => {
        beforeEach(async () => {
            await plugin.onRegister(context, options);
        });

        it('should start the adapter', async () => {
            await plugin.onStart();

            expect(adapter.start).toHaveBeenCalledTimes(1);
        });

        it('should log the start message', async () => {
            await plugin.onStart();

            expect(logger.info).toHaveBeenCalledWith('Plugin started. Listening on port 3000');
        });
    });

    describe('onStop', () => {
        beforeEach(async () => {
            await plugin.onRegister(context, options);
        });

        it('should stop the adapter', async () => {
            await plugin.onStop();

            expect(adapter.stop).toHaveBeenCalledTimes(1);
        });

        it('should log the stop message', async () => {
            await plugin.onStop();

            expect(logger.info).toHaveBeenCalledWith('Plugin stopped');
        });
    });
});
