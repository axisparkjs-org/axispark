import { AxiSparkContext, PluginNotConfiguredError, Plugin } from '@axisparkjs/core';
import { HttpPluginOptions } from './http-plugin-options';
import { HTTP_ADAPTER, HTTP_LOGGER, HTTP_OPTIONS } from '../di/tokens';
import { HttpAdapter } from '../adapter/http-adapter';
import { RouteGenerator, RouteDefinition, RouteValidator } from '../routes';
import { Logger } from '@axisparkjs/logger';
import { ClassRegistry, Injectable, InjectableScopes, Injector } from '@axisparkjs/di';
import { ClassType } from '@axisparkjs/common';
import { HttpParameter } from '../types';
import { VersionProcessor, VersionType } from '../version';
import {
    ExecutionTransport,
    ParameterGenerator,
    RateLimitGenerator,
    RateLimitProcessor,
    ResultProcessor,
    TimeoutGenerator,
    TimeoutProcessor
} from '@axisparkjs/engine';
import {
    LogHttpRequestInterceptor,
    LogHttpResponseInterceptor,
    LogHttpErrorFilter,
    LogErrorFilter,
    HealthController,
    HostGuard,
    RateLimitGuard,
    FileUploadGuard,
    VersionGuard,
    RequestResolver,
    ResponseResolver,
    IpResolver,
    BodyResolver,
    PathResolver,
    QueryResolver,
    CookieResolver,
    HeaderResolver,
    SessionResolver,
    UploadedFileResolver,
    UploadedFilesResolver,
    HttpResultResolver,
    HttpTimeoutResolver,
    HttpRateLimitResolver,
    UriVersionResolver,
    HeaderVersionResolver,
    MediaTypeVersionResolver
} from '../implementations';

/**
 * A plugin for handling HTTP server.
 */
@Injectable()
export class HttpPlugin extends Plugin {
    private context: AxiSparkContext;
    protected options: HttpPluginOptions;
    private adapter: HttpAdapter;

    constructor(
        private logger: Logger,
        private readonly injector: Injector
    ) {
        super();
    }

    async onRegister(context: AxiSparkContext, options?: HttpPluginOptions): Promise<void> {
        if (!options) throw new PluginNotConfiguredError(HttpPlugin.name);
        this.context = context;
        this.options = options;
        this.logger = this.logger.child('HttpPlugin');

        this.registerContainerBindings();
        this.configureImplementations();
        await this.registerImplementations();
        const routes = await this.generateRoutes();
        await this.validateRoutes(routes);

        this.adapter = await this.context.container.resolve<HttpAdapter>(HTTP_ADAPTER);
        await this.adapter.initialize?.();
        await this.adapter.registerRoutes(routes);
        await this.logger.info(`Plugin registered`);
    }

    private async validateRoutes(routes: RouteDefinition[]): Promise<void> {
        const routeValidator = await this.injector.get(RouteValidator);
        await routeValidator.validate(routes);
    }

    private registerContainerBindings(): void {
        this.context.container.bind({ token: HTTP_OPTIONS, useValue: this.options });
        this.context.container.bind({ token: HTTP_ADAPTER, useClass: this.options.adapter, scope: InjectableScopes.Singleton });
        this.context.container.bind({ token: HTTP_LOGGER, useValue: this.logger });
    }

    private async generateRoutes(): Promise<RouteDefinition[]> {
        const routeGenerator = await this.injector.get(RouteGenerator);
        const routes = await routeGenerator.generate();

        const controllers = new Set<ClassType>();
        for (const route of routes) {
            if (!controllers.has(route.target)) {
                controllers.add(route.target);
                await this.logger.info(`Registered controller ${route.target.name}`);
            }

            await this.logger.debug(
                `Registered route ${route.httpMethod.toLocaleUpperCase()} ${route.path} for controller ${route.target.name}${route.versions.length > 0 ? ` with versions ${route.versions.join(', ')}` : ''}`
            );
        }
        return routes;
    }

    private configureImplementations(): void {
        const items: [boolean, ClassType][] = [
            [this.options.healthChecks ?? false, HealthController],
            [this.options.logHttpRequests ?? false, LogHttpRequestInterceptor],
            [this.options.logHttpResponses ?? false, LogHttpResponseInterceptor],
            [this.options.logHttpErrors ?? false, LogHttpErrorFilter],
            [this.options.logErrors ?? false, LogErrorFilter],
            [true, HostGuard],
            [this.options.rateLimit ?? false, RateLimitGuard],
            [this.options.fileUpload ?? false, FileUploadGuard],
            [this.options.version ?? false, VersionGuard]
        ];

        for (const [enabled, target] of items) {
            this.disableComponentIf(enabled, target);
        }
    }

    private async registerImplementations(): Promise<void> {
        ResultProcessor.registerResult(ExecutionTransport.Http, await this.injector.get(HttpResultResolver));

        if (this.options.timeout) {
            TimeoutGenerator.registerTimeout(ExecutionTransport.Http, this.options.timeoutOptions?.time);
            TimeoutProcessor.registerTimeout(ExecutionTransport.Http, await this.injector.get(HttpTimeoutResolver));
        }

        if (this.options.rateLimit) {
            RateLimitGenerator.registerRateLimit(ExecutionTransport.Http, {
                ttl: this.options.rateLimitOptions?.ttl,
                limit: this.options.rateLimitOptions?.limit
            });
            RateLimitProcessor.registerRateLimit(ExecutionTransport.Http, await this.injector.get(HttpRateLimitResolver));
        } else {
            RateLimitGenerator.registerRateLimit(ExecutionTransport.Http);
            RateLimitProcessor.registerRateLimit(ExecutionTransport.Http);
        }

        ParameterGenerator.registerParameter(HttpParameter.Request, await this.injector.get(RequestResolver));
        ParameterGenerator.registerParameter(HttpParameter.Response, await this.injector.get(ResponseResolver));
        ParameterGenerator.registerParameter(HttpParameter.Body, await this.injector.get(BodyResolver));
        ParameterGenerator.registerParameter(HttpParameter.Path, await this.injector.get(PathResolver));
        ParameterGenerator.registerParameter(HttpParameter.Query, await this.injector.get(QueryResolver));
        ParameterGenerator.registerParameter(HttpParameter.Header, await this.injector.get(HeaderResolver));
        ParameterGenerator.registerParameter(HttpParameter.Ip, await this.injector.get(IpResolver));
        ParameterGenerator.registerParameter(HttpParameter.Session, await this.injector.get(SessionResolver));
        ParameterGenerator.registerParameter(HttpParameter.Cookie, await this.injector.get(CookieResolver));
        ParameterGenerator.registerParameter(HttpParameter.UploadedFile, await this.injector.get(UploadedFileResolver));
        ParameterGenerator.registerParameter(HttpParameter.UploadedFiles, await this.injector.get(UploadedFilesResolver));

        if (this.options.version) {
            VersionProcessor.registerVersion(VersionType.Header, await this.injector.get(HeaderVersionResolver));
            VersionProcessor.registerVersion(VersionType.MediaType, await this.injector.get(MediaTypeVersionResolver));
            VersionProcessor.registerVersion(VersionType.Uri, await this.injector.get(UriVersionResolver));
        }
    }

    private disableComponentIf(enabled: boolean, target: ClassType): void {
        if (enabled) return;

        ClassRegistry.remove(target);
        this.context.container.unbind(target);
    }

    async onStart(): Promise<void> {
        await this.adapter.start();
        await this.logger.info(`Plugin started. Listening on port ${this.options.port}`);
    }

    async onStop(): Promise<void> {
        await this.adapter.stop();
        await this.logger.info(`Plugin stopped`);
    }
}
