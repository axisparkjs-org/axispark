import { ClassRegistry, Injectable, Inject } from '@axisparkjs/di';
import { Generator, Metadata, MetadataKeys } from '@axisparkjs/common';
import { RouteDefinition } from './route-definition';
import { ControllerMetadata } from '../metadata/controller-metadata';
import { RouteMetadata } from '../metadata/route-metadata';
import { HttpPluginOptions } from '../plugin/http-plugin-options';
import { HTTP_OPTIONS } from '../di';
import { HttpEngine } from '../engine/http-engine';
import { VersionType } from '../version';

/**
 * A generator for creating route definitions based on controller and route metadata.
 */
@Injectable()
export class RouteGenerator implements Generator<RouteDefinition[]> {
    constructor(
        private readonly httpEngine: HttpEngine,
        @Inject(HTTP_OPTIONS) private readonly httpPluginOptions: HttpPluginOptions
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

            const hosts: string[] = this.arrayifyFromString(controllerMetadata.host) ?? ['*'];
            const versionOptions = this.httpPluginOptions.versionOptions;
            const versionUriEnabled = this.httpPluginOptions.version && versionOptions !== undefined && versionOptions.type === VersionType.Uri;
            for (const routeMetadata of routesMetadata) {
                let versions: string[] = [];
                if (this.httpPluginOptions.version)
                    versions =
                        this.arrayifyFromString(routeMetadata.version) ??
                        this.arrayifyFromString(controllerMetadata.version) ??
                        (versionOptions && versionOptions.type === VersionType.Uri && versionOptions.defaultVersion
                            ? (this.arrayifyFromString(versionOptions.defaultVersion) as string[])
                            : ['*']);

                const routePath = this.pathCreator(this.httpPluginOptions.basePath, controllerMetadata.path, routeMetadata.path, versionUriEnabled);
                const routeDefinition = new RouteDefinition(
                    routeMetadata.target,
                    routeMetadata.propertyKey,
                    routeMetadata.method,
                    routePath,
                    versions,
                    hosts,
                    async () => {
                        /* Empty by default, will be replaced when grouped */
                    }
                );
                routes.push(routeDefinition);
            }
        }
        return this.groupRoutes(routes);
    }

    private groupRoutes(routes: RouteDefinition[]): RouteDefinition[] {
        const routesByPath = new Map<string, RouteDefinition[]>();
        for (const route of routes) {
            const key = JSON.stringify([route.httpMethod.toLowerCase(), route.path]);
            const routeGroup = routesByPath.get(key) ?? [];
            routeGroup.push(route);
            routesByPath.set(key, routeGroup);
        }

        return [...routesByPath.values()].map((routeGroup) => {
            const firstRoute = routeGroup[0];
            return new RouteDefinition(
                firstRoute.target,
                firstRoute.propertyKey,
                firstRoute.httpMethod,
                firstRoute.path,
                firstRoute.versions,
                firstRoute.hosts,
                async (context) => await this.httpEngine.execute(context, routeGroup),
                routeGroup
            );
        });
    }

    private arrayifyFromString(value: string | string[] | undefined): string[] | undefined {
        if (!value) {
            return undefined;
        }
        if (Array.isArray(value)) {
            return value;
        }
        return [value];
    }

    private pathCreator(basePath: string, controllerPath: string, routePath: string, version: boolean): string {
        basePath = basePath.startsWith('/') ? basePath : `/${basePath}`;

        if (version) {
            basePath = `${basePath}/v:version`;
        }

        controllerPath = controllerPath.startsWith('/') ? controllerPath : `/${controllerPath}`;
        routePath = routePath.startsWith('/') ? routePath : `/${routePath}`;
        return `${basePath}${controllerPath}${routePath}`.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
    }
}
