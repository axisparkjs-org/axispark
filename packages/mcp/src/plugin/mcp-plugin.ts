import { AxiSparkContext, Plugin, PluginNotConfiguredError } from '@axisparkjs/core';
import { Injectable, Injector } from '@axisparkjs/di';
import { ExecutionTransport, ParameterGenerator, ResultProcessor, TimeoutGenerator, TimeoutProcessor } from '@axisparkjs/engine';
import { HTTP_ADAPTER, HTTP_OPTIONS, HttpAdapter, HttpPlugin, HttpPluginOptions } from '@axisparkjs/http';
import { Logger } from '@axisparkjs/logger';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { McpDefinitionGenerator, McpDefinitions } from '../definitions';
import { MCP_DEFINITIONS, MCP_LOGGER, MCP_OPTIONS, MCP_SERVER, MCP_TRANSPORT } from '../di/tokens';
import { McpArgsResolver, McpContextResolver, McpParamResolver, McpResultResolver, McpSessionResolver, McpTimeoutResolver } from '../implementations';
import { McpServerBuilder, McpServerInfo } from '../server';
import { McpHttpTransport, McpStdioTransport, McpTransport, normalizeMcpPath } from '../transports';
import { McpParameter } from '../types';
import { McpPluginOptions } from './mcp-plugin-options';

const DEFAULT_PATH = '/mcp';
const DEFAULT_PORT = 3000;
const DEFAULT_VERSION = '1.0.0';

/**
 * A plugin for exposing the tools, resources and prompts of the application to AI clients through the Model Context Protocol (MCP).
 */
@Injectable()
export class McpPlugin extends Plugin {
    static override readonly dependencies = [{ plugin: HttpPlugin, optional: true }];

    private context: AxiSparkContext;
    protected options: McpPluginOptions;
    private transport: McpTransport;
    private endpoint: string;

    constructor(
        private logger: Logger,
        private readonly injector: Injector
    ) {
        super();
    }

    async onRegister(context: AxiSparkContext, options?: McpPluginOptions): Promise<void> {
        if (!options) throw new PluginNotConfiguredError(McpPlugin.name);
        this.context = context;
        this.options = options;
        this.logger = this.logger.child('McpPlugin');

        this.registerContainerBindings();
        await this.registerImplementations();
        const definitions = await this.generateDefinitions();

        const builder = await this.injector.get(McpServerBuilder);
        builder.configure(this.resolveServerInfo(), definitions);
        this.context.container.bind({ token: MCP_DEFINITIONS, useValue: definitions });
        this.context.container.bind({ token: MCP_SERVER, useValue: builder });

        this.transport = await this.createTransport(builder);
        this.context.container.bind({ token: MCP_TRANSPORT, useValue: this.transport });
        await this.logger.info(`Plugin registered`);
    }

    private registerContainerBindings(): void {
        this.context.container.bind({ token: MCP_OPTIONS, useValue: this.options });
        this.context.container.bind({ token: MCP_LOGGER, useValue: this.logger });
    }

    private async registerImplementations(): Promise<void> {
        ResultProcessor.registerResult(ExecutionTransport.Mcp, await this.injector.get(McpResultResolver));
        TimeoutProcessor.registerTimeout(ExecutionTransport.Mcp, await this.injector.get(McpTimeoutResolver));
        if (this.options.timeout !== undefined) TimeoutGenerator.registerTimeout(ExecutionTransport.Mcp, this.options.timeout);

        ParameterGenerator.registerParameter(McpParameter.Args, await this.injector.get(McpArgsResolver));
        ParameterGenerator.registerParameter(McpParameter.Param, await this.injector.get(McpParamResolver));
        ParameterGenerator.registerParameter(McpParameter.Session, await this.injector.get(McpSessionResolver));
        ParameterGenerator.registerParameter(McpParameter.Context, await this.injector.get(McpContextResolver));
    }

    private async generateDefinitions(): Promise<McpDefinitions> {
        const generator = await this.injector.get(McpDefinitionGenerator);
        const definitions = await generator.generate();

        for (const tool of definitions.tools) {
            await this.logger.debug(`Registered tool ${tool.name} for ${tool.target.name}`);
        }
        for (const resource of definitions.resources) {
            await this.logger.debug(`Registered resource ${resource.uri} for ${resource.target.name}`);
        }
        for (const prompt of definitions.prompts) {
            await this.logger.debug(`Registered prompt ${prompt.name} for ${prompt.target.name}`);
        }
        await this.logger.info(
            `Registered ${definitions.tools.length} tools, ${definitions.resources.length} resources and ${definitions.prompts.length} prompts`
        );
        return definitions;
    }

    private resolveServerInfo(): McpServerInfo {
        return {
            name: this.options.name ?? (this.context.config.name as string),
            version: this.options.version ?? this.resolveApplicationVersion() ?? DEFAULT_VERSION,
            ...(this.options.instructions ? { instructions: this.options.instructions } : {})
        };
    }

    /**
     * Reads the version of the nearest `package.json`, starting at the base path of the application.
     */
    private resolveApplicationVersion(): string | undefined {
        let directory = this.context.config.basePath ?? process.cwd();
        for (;;) {
            const file = join(directory, 'package.json');
            if (existsSync(file)) {
                try {
                    const version = JSON.parse(readFileSync(file, 'utf8')).version;
                    return typeof version === 'string' ? version : undefined;
                } catch {
                    return undefined;
                }
            }
            const parent = dirname(directory);
            if (parent === directory) return undefined;
            directory = parent;
        }
    }

    private async createTransport(builder: McpServerBuilder): Promise<McpTransport> {
        const onError = (error: Error) => void this.logger.error('MCP transport error', error);

        if (this.options.transport === 'stdio') {
            this.endpoint = 'on the standard input and output';
            return new McpStdioTransport(() => builder.build('stdio'), onError);
        }

        const path = this.options.path ?? DEFAULT_PATH;
        const common = { allowedHosts: this.options.allowedHosts, allowedOrigins: this.options.allowedOrigins, onError };
        if (this.options.useHttpPluginServer) {
            const { httpOptions, httpAdapter } = await this.resolveHttpPlugin();
            const transport = new McpHttpTransport(() => builder.build('http'), {
                ...common,
                path: normalizeMcpPath(`${httpOptions.basePath ?? ''}/${path}`),
                server: httpAdapter.getHttpServer()
            });
            this.endpoint = `at ${transport.endpoint} on the HTTP plugin port ${httpOptions.port}`;
            return transport;
        }

        const port = this.options.port ?? DEFAULT_PORT;
        const transport = new McpHttpTransport(() => builder.build('http'), { ...common, path, port });
        this.endpoint = `at ${transport.endpoint} on port ${port}`;
        return transport;
    }

    private async resolveHttpPlugin(): Promise<{ httpOptions: HttpPluginOptions; httpAdapter: HttpAdapter }> {
        try {
            return {
                httpOptions: await this.injector.get<HttpPluginOptions>(HTTP_OPTIONS),
                httpAdapter: await this.injector.get<HttpAdapter>(HTTP_ADAPTER)
            };
        } catch (error) {
            throw new Error(
                `McpPlugin is configured with useHttpPluginServer, but the HttpPlugin is not registered. Register the HttpPlugin before the McpPlugin.`,
                {
                    cause: error
                }
            );
        }
    }

    async onStart(): Promise<void> {
        await this.transport.start();
        await this.logger.info(`Plugin started. MCP server listening with the ${this.options.transport} transport ${this.endpoint}`);
    }

    async onStop(): Promise<void> {
        await this.transport?.stop();
        await this.logger.info(`Plugin stopped`);
    }
}
