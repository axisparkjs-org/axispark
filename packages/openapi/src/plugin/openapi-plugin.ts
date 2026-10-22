import { AxiSparkContext, Plugin } from '@axisparkjs/core';
import { Logger } from '@axisparkjs/logger';
import { OpenApiPluginOptions } from './openapi-plugin-options';
import { OPENAPI_LOGGER, OPENAPI_OPTIONS } from '../di';
import { HttpPlugin } from '@axisparkjs/http';
import { HttpPluginOptions } from '@axisparkjs/http';
import { HTTP_OPTIONS } from '@axisparkjs/http';
import { PluginNotConfiguredError } from '@axisparkjs/core';
import { OpenApiDocumentDefinition } from '../document/openapi-document-definition';
import { OpenApiDocumentGenerator } from '../document/openapi-document-generator';
import { HttpAdapter } from '@axisparkjs/http';
import { HTTP_ADAPTER } from '@axisparkjs/http';
import { RouteDefinition } from '@axisparkjs/http';
import { HttpMethod } from '@axisparkjs/http';
import { Injectable, Injector } from '@axisparkjs/di';
import { ClassType } from '@axisparkjs/common';

/**
 * A plugin for integrating OpenAPI documentation into the application.
 */
@Injectable()
export class OpenApiPlugin extends Plugin {
    static override readonly dependencies = [HttpPlugin];

    private context: AxiSparkContext;
    protected options: OpenApiPluginOptions;
    private httpOptions: HttpPluginOptions;
    private httpAdapter: HttpAdapter;
    private docsUrls: { jsonUrl: string; yamlUrl: string };
    private document: OpenApiDocumentDefinition;

    constructor(
        private logger: Logger,
        private readonly injector: Injector
    ) {
        super();
    }

    async onRegister(context: AxiSparkContext, options?: OpenApiPluginOptions): Promise<void> {
        if (!options) throw new PluginNotConfiguredError(OpenApiPlugin.name);
        this.context = context;
        this.options = options;
        this.logger = this.logger.child('OpenApiPlugin');
        this.httpOptions = await this.injector.get(HTTP_OPTIONS);
        this.httpAdapter = await this.injector.get(HTTP_ADAPTER);

        this.registerContainerBindings();
        this.generateDocsUrl();
        this.configureRoutes();
        await this.generateDocument();

        await this.logger.info(`Plugin registered`);
    }

    private registerContainerBindings(): void {
        this.context.container.bind({ token: OPENAPI_OPTIONS, useValue: this.options });
        this.context.container.bind({ token: OPENAPI_LOGGER, useValue: this.logger });
    }

    private generateDocsUrl(): void {
        let basePath = this.options.globalPrefix ? this.httpOptions.basePath : '';
        let docsUrl = this.options.docsUrl ?? '';
        let yamlDocumentUrl = this.options.yamlDocumentUrl ?? 'openapi.yml';
        let jsonDocumentUrl = this.options.jsonDocumentUrl ?? 'openapi.json';
        basePath = basePath.startsWith('/') ? basePath : `/${basePath}`;
        docsUrl = docsUrl.startsWith('/') ? docsUrl : `/${docsUrl}`;
        yamlDocumentUrl = yamlDocumentUrl.startsWith('/') ? yamlDocumentUrl : `/${yamlDocumentUrl}`;
        jsonDocumentUrl = jsonDocumentUrl.startsWith('/') ? jsonDocumentUrl : `/${jsonDocumentUrl}`;

        const urls = {
            jsonUrl: `${basePath}${docsUrl}${jsonDocumentUrl}`.replace(/\/+/g, '/').replace(/\/$/, '') || '/',
            yamlUrl: `${basePath}${docsUrl}${yamlDocumentUrl}`.replace(/\/+/g, '/').replace(/\/$/, '') || '/'
        };
        this.docsUrls = urls;
    }

    private configureRoutes(): void {
        const routes: RouteDefinition[] = [];
        if (this.options.exposeJson)
            routes.push(
                new RouteDefinition(
                    { name: 'OpenApiController' } as ClassType,
                    'getOpenApiJson',
                    HttpMethod.Get,
                    this.docsUrls.jsonUrl,
                    ['*'],
                    ['*'],
                    async (context) => {
                        context.response.json(this.document.toObject());
                    }
                )
            );

        if (this.options.exposeYaml)
            routes.push(
                new RouteDefinition(
                    { name: 'OpenApiController' } as ClassType,
                    'getOpenApiYaml',
                    HttpMethod.Get,
                    this.docsUrls.yamlUrl,
                    ['*'],
                    ['*'],
                    async (context) => {
                        context.response.header('Content-Type', 'text/yaml').send(this.document.toYaml());
                    }
                )
            );

        this.httpAdapter.registerRoutes(routes);
    }

    private async generateDocument(): Promise<void> {
        const openApiDocumentGenerator = await this.injector.get(OpenApiDocumentGenerator);
        this.document = openApiDocumentGenerator.generate(this.httpAdapter.getRegisteredRoutes());
    }

    async onStart(): Promise<void> {
        await this.logger.info(`Plugin started. OpenAPI documentation available`);
        await this.logger.info(`JSON: ${this.options.exposeJson ? this.docsUrls.jsonUrl : 'Not exposed'}`);
        await this.logger.info(`YAML: ${this.options.exposeYaml ? this.docsUrls.yamlUrl : 'Not exposed'}`);
    }

    async onStop(): Promise<void> {
        await this.logger.info(`Plugin stopped`);
    }
}
