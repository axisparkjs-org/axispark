import { Executable } from '@axisparkjs/common';
import { HttpContext } from '../types';
import { Injectable, ScopedContainerManager } from '@axisparkjs/di';
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
    constructor(
        private readonly executionEngine: ExecutionEngine,
        private readonly hostProcessor: HostProcessor,
        private readonly versionProcessor: VersionProcessor,
        private readonly hostMatcher: HostMatcher,
        private readonly versionMatcher: VersionMatcher,
        private readonly scopedContainerManager: ScopedContainerManager
    ) {}

    /**
     * Executes the HTTP engine with the provided context.
     * @param context The HTTP context for execution.
     * @param routes The routes to map which will be executed.
     */
    public async execute(context: Pick<HttpContext, 'request' | 'response' | 'session'>, routes: RouteDefinition[]): Promise<void> {
        const hostDefinition = new HostDefinition();
        const versionDefinition = new VersionDefinition();

        this.hostProcessor.process(hostDefinition, context);
        this.versionProcessor.process(versionDefinition, context);

        const hostRoutes = this.hostMatcher.match(routes, hostDefinition);
        const versionRoute = this.versionMatcher.match(hostRoutes, versionDefinition);

        hostDefinition.setAcceptedHosts(versionRoute.hosts);
        versionDefinition.setAcceptedVersions(versionRoute.versions);

        const filledContext: HttpContext = {
            ...context,
            scopedContainer: this.scopedContainerManager.create(),
            transport: ExecutionTransport.Http,
            target: versionRoute.target,
            propertyKey: versionRoute.propertyKey,
            host: hostDefinition,
            version: versionDefinition,
            error: undefined
        };

        await this.executionEngine.execute(filledContext);
    }
}
