import { ClassRegistry, Injectable, Inject, ScopedContainerManager } from '@axisparkjs/di';
import { Generator, Metadata, MetadataKeys } from '@axisparkjs/common';
import { RouteDefinition } from './route-definition';
import { ControllerMetadata } from '../metadata/controller-metadata';
import { RouteMetadata } from '../metadata/route-metadata';
import { ExecutionTransport } from '@axisparkjs/engine';
import { HttpPluginOptions } from '../plugin/http-plugin-options';
import { HTTP_OPTIONS } from '../di';
import { HttpEngine } from '../engine/http-engine';
import { VersionType } from '../version';
import { HttpContext } from '../types';
import { RateLimitMetadata } from '../metadata/rate-limit-metadata';
import { HttpRateLimitResolver } from '../implementations/rate-limits';
import { RateLimitDecoratorOptions } from '../plugin/http-plugin-options';

/**
 * A generator for creating route definitions based on controller and route metadata.
 */
@Injectable()
export class RouteGenerator implements Generator<RouteDefinition[]> {
    constructor(
        private readonly httpEngine: HttpEngine,
        private readonly scopedContainerManager: ScopedContainerManager,
        @Inject(HTTP_OPTIONS) private readonly httpPluginOptions: HttpPluginOptions,
        private readonly rateLimitResolver: HttpRateLimitResolver
    ) {}

    /**
     * Generates route definitions based on controller and route metadata.
     * @returns An array of route definitions.
     */
    async generate(): Promise<RouteDefinition[]> {
        const routes: RouteDefinition[] = [];

        const controllers = ClassRegistry.getWithMetadata(MetadataKeys.CONTROLLER);
        for (const controller of controllers) {
            const controllerMetadata = Metadata.get<ControllerMetadata>(MetadataKeys.CONTROLLER, controller) as ControllerMetadata;
            const routesMetadata = Metadata.get<RouteMetadata[]>(MetadataKeys.ROUTE, controller) ?? [];

            for (const routeMetadata of routesMetadata) {
                let finalVersions: string[] | undefined = undefined;
                const versionOptions = this.httpPluginOptions.versionOptions;
                const versionUriEnabled = this.httpPluginOptions.version && versionOptions !== undefined && versionOptions.type === VersionType.Uri;
                if (this.httpPluginOptions.version)
                    finalVersions =
                        this.arrayifyFromVersion(routeMetadata.version) ??
                        this.arrayifyFromVersion(controllerMetadata.version) ??
                        (versionOptions && versionOptions.type === VersionType.Uri && versionOptions.defaultVersion
                            ? this.arrayifyFromVersion(versionOptions.defaultVersion)
                            : ['default']);

                const routePath = this.pathCreator(this.httpPluginOptions.basePath, controllerMetadata.prefix, routeMetadata.path, versionUriEnabled);
                const rateLimitOptions = this.resolveRateLimitOptions(routeMetadata.target, routeMetadata.propertyKey);
                const rateLimitEndpoint = `${routeMetadata.method}:${routePath}:${routeMetadata.target.name}.${String(routeMetadata.propertyKey)}`;
                const routeDefinition = new RouteDefinition(
                    routeMetadata.target,
                    routeMetadata.propertyKey,
                    routeMetadata.method,
                    routePath,
                    finalVersions,
                    async (context) => {
                        if (rateLimitOptions) {
                            const decision = this.rateLimitResolver.consume(context.request.ip, rateLimitEndpoint, rateLimitOptions);
                            if (!decision.allowed) {
                                context.response
                                    .status(429)
                                    .header('Retry-After', String(Math.max(1, Math.ceil(decision.retryAfterMs / 1000))))
                                    .json({ message: this.rateLimitResolver.getMessage(decision.retryAfterMs) });
                                return;
                            }
                        }
                        await this.httpEngine.execute(this.fillContext(context, routeMetadata));
                    }
                );
                routes.push(routeDefinition);
            }
        }
        if (this.httpPluginOptions.version) return this.groupRoutesByPathMergingVersions(routes);
        return routes;
    }

    private resolveRateLimitOptions(target: object, propertyKey: string | symbol): RateLimitDecoratorOptions | undefined {
        if (!this.httpPluginOptions.rateLimit) return undefined;

        const handlerMetadata = Metadata.get<RateLimitMetadata>(MetadataKeys.RATE_LIMIT, target, propertyKey);
        if (handlerMetadata) return handlerMetadata.disabled ? undefined : (handlerMetadata.options ?? {});

        const controllerMetadata = Metadata.get<RateLimitMetadata>(MetadataKeys.RATE_LIMIT, target);
        if (controllerMetadata) return controllerMetadata.disabled ? undefined : (controllerMetadata.options ?? {});

        return {};
    }

    private groupRoutesByPathMergingVersions(routes: RouteDefinition[]): RouteDefinition[] {
        const routesByPath: Record<string, RouteDefinition[]> = {};
        for (const route of routes) {
            const key = `${route.httpMethod}:${route.path}`;
            if (!routesByPath[key]) {
                routesByPath[key] = [];
            }
            routesByPath[key].push(route);
        }

        const mergedRoutes: RouteDefinition[] = [];
        for (const key in routesByPath) {
            const routeGroup = routesByPath[key];
            const mergedVersions = routeGroup.flatMap((route) => route.versions as string[]);
            const mergedRoute = new RouteDefinition(
                routeGroup[0].target,
                '',
                routeGroup[0].httpMethod,
                routeGroup[0].path,
                mergedVersions,
                async (context) => await this.httpEngine.versionMapping(routeGroup, context)
            );
            mergedRoutes.push(mergedRoute);
        }

        return mergedRoutes;
    }

    private arrayifyFromVersion(value: string | string[] | undefined): string[] | undefined {
        if (!value) {
            return undefined;
        }
        if (Array.isArray(value)) {
            return value;
        }
        return [value];
    }

    private fillContext(context: Pick<HttpContext, 'request' | 'response' | 'session'>, routeMetadata: RouteMetadata): HttpContext {
        return {
            ...context,
            target: routeMetadata.target,
            propertyKey: routeMetadata.propertyKey,
            scopedContainer: this.scopedContainerManager.create(),
            transport: ExecutionTransport.Http,
            version: undefined,
            error: undefined
        };
    }

    private pathCreator(basePath: string, prefix: string, path: string, version: boolean): string {
        basePath = basePath.startsWith('/') ? basePath : `/${basePath}`;

        if (version) {
            basePath = `${basePath}/v:version`;
        }

        prefix = prefix.startsWith('/') ? prefix : `/${prefix}`;
        path = path.startsWith('/') ? path : `/${path}`;
        return `${basePath}${prefix}${path}`.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
    }
}
