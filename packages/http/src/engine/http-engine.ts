import { Executable } from '@axisparkjs/common';
import { HttpContext } from '../types';
import { Inject, Injectable, ScopedContainerManager } from '@axisparkjs/di';
import { Logger } from '@axisparkjs/logger';
import { HTTP_LOGGER, HTTP_OPTIONS } from '../di/tokens';
import { HttpPluginOptions } from '../plugin/http-plugin-options';
import { ErrorHttpResult } from '../implementations/results/http-result';
import { InternalServerError } from '../implementations/errors';
import { ExecutionEngine } from '@axisparkjs/engine';
import { VersionProcessor, VersionMatcher, VersionDefinition } from '../version';
import { RouteDefinition } from '../routes';
import { HostDefinition, HostMatcher, HostProcessor } from '../host';
import { ExecutionTransport } from '@axisparkjs/engine';

/**
 * A class for handling HTTP engine operations.
 */
@Injectable()
export class HttpEngine implements Executable {
    /* Whether each group of routes can skip the host and version matching, computed once per group. */
    private readonly unrestrictedGroups = new WeakMap<readonly RouteDefinition[], boolean>();

    constructor(
        private readonly executionEngine: ExecutionEngine,
        private readonly hostProcessor: HostProcessor,
        private readonly versionProcessor: VersionProcessor,
        private readonly hostMatcher: HostMatcher,
        private readonly versionMatcher: VersionMatcher,
        private readonly scopedContainerManager: ScopedContainerManager,
        @Inject(HTTP_LOGGER) private readonly logger: Logger,
        @Inject(HTTP_OPTIONS) private readonly options: HttpPluginOptions
    ) {}

    /**
     * Executes the HTTP engine with the provided context.
     * @param context The HTTP context for execution, created by the adapter for this request. It is completed in place with the rest of
     * the properties of the `HttpContext` instead of being copied.
     * @param routes The routes to map which will be executed.
     * When the group has a single route that accepts every host (`*`) and has no versions (versioning disabled), the host and version
     * matching is skipped and `context.host` and `context.version` are `undefined`.
     * The errors that happen after the handler and the filters, while the response is sent (such as a stream that fails), are logged with the route instead of being thrown to the adapter. When the response has not started yet, it is answered with `500`.
     */
    public async execute(context: Pick<HttpContext, 'request' | 'response' | 'session'>, routes: RouteDefinition[]): Promise<void> {
        let versionRoute: RouteDefinition;
        let hostDefinition: HostDefinition | undefined;
        let versionDefinition: VersionDefinition | undefined;
        if (this.isUnrestricted(routes)) {
            // A single route that accepts every host and has no versions: there is nothing to match, and the guards have nothing to check.
            versionRoute = routes[0];
        } else {
            hostDefinition = new HostDefinition();
            versionDefinition = new VersionDefinition();

            this.hostProcessor.process(hostDefinition, context);
            this.versionProcessor.process(versionDefinition, context);

            const hostRoutes = this.hostMatcher.match(routes, hostDefinition);
            versionRoute = this.versionMatcher.match(hostRoutes, versionDefinition);

            hostDefinition.setAcceptedHosts(versionRoute.hosts);
            versionDefinition.setAcceptedVersions(versionRoute.versions);
        }

        // The context of the adapter is created for this request, so it is filled instead of copied. Its properties, such as a lazy
        // session getter, are kept as they are.
        const filledContext = context as HttpContext;
        filledContext.scopedContainer = this.scopedContainerManager.create();
        filledContext.transport = ExecutionTransport.Http;
        // The engine replaces it with the signal of the execution, aborted when this one is.
        filledContext.signal = context.request.signal ?? new AbortController().signal;
        filledContext.target = versionRoute.target;
        filledContext.propertyKey = versionRoute.propertyKey;
        filledContext.host = hostDefinition;
        filledContext.version = versionDefinition;
        filledContext.error = undefined;

        try {
            await this.executionEngine.execute(filledContext);
        } catch (error) {
            if (!filledContext.response.isCommitted()) {
                await new ErrorHttpResult(new InternalServerError('Internal server error')).process(filledContext);
            }
            if (this.options.logErrors === false) return;
            const route = `${versionRoute.target.name}.${String(versionRoute.propertyKey)}`;
            const { name, message } = error as Error;
            await this.logger.error(`Error while sending the response of ${route}: ${name} -> ${message}`, error as Error);
        }
    }

    private isUnrestricted(routes: readonly RouteDefinition[]): boolean {
        let unrestricted = this.unrestrictedGroups.get(routes);
        if (unrestricted === undefined) {
            const [route] = routes;
            unrestricted = routes.length === 1 && route.versions.length === 0 && route.hosts.some((host) => host.trim() === '*');
            this.unrestrictedGroups.set(routes, unrestricted);
        }
        return unrestricted;
    }
}
