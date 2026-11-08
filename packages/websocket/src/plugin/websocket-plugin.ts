import { AxiSparkContext, PluginNotConfiguredError, Plugin } from '@axisparkjs/core';
import { WebSocketPluginOptions } from './websocket-plugin-options';
import { WEBSOCKET_ADAPTER, WEBSOCKET_LOGGER, WEBSOCKET_OPTIONS } from '../di/tokens';
import { Logger } from '@axisparkjs/logger';
import { Injectable, InjectableScopes, Injector } from '@axisparkjs/di';
import { WebSocketAdapter } from '../adapter';
import { HttpPlugin } from '@axisparkjs/http';
import { HttpAdapter } from '@axisparkjs/http';
import { HttpPluginOptions } from '@axisparkjs/http';
import { HTTP_OPTIONS } from '@axisparkjs/http';
import { HTTP_ADAPTER } from '@axisparkjs/http';
import { WebSocketEventDefinition, WebSocketEventGenerator } from '../events';
import { WebSocketParameter } from '../types';
import { WsAckResolver, WsConnectionResolver, WsDataResolver, WsMessageResolver, WebSocketResultResolver, WebSocketTimeoutResolver } from '../implementations';
import { ParameterGenerator } from '@axisparkjs/engine';
import { ResultProcessor } from '@axisparkjs/engine';
import { ExecutionTransport } from '@axisparkjs/engine';
import { TimeoutGenerator, TimeoutProcessor } from '@axisparkjs/engine';

/**
 * A plugin for handling WebSockets.
 */
@Injectable()
export class WebSocketPlugin extends Plugin {
    static override readonly dependencies = [{ plugin: HttpPlugin, optional: true }];

    private context: AxiSparkContext;
    protected options: WebSocketPluginOptions;
    private adapter: WebSocketAdapter;
    private httpAdapter: HttpAdapter;
    private httpOptions: HttpPluginOptions;

    constructor(
        private logger: Logger,
        private readonly injector: Injector
    ) {
        super();
    }

    async onRegister(context: AxiSparkContext, options?: WebSocketPluginOptions): Promise<void> {
        if (!options) throw new PluginNotConfiguredError(WebSocketPlugin.name);
        this.context = context;
        this.options = options;
        this.logger = this.logger.child('WebSocketPlugin');
        if (this.options.useHttpPluginServer) {
            this.httpOptions = await this.injector.get(HTTP_OPTIONS);
            this.httpAdapter = await this.injector.get(HTTP_ADAPTER);
            // The connections share the server of the HTTP plugin, so they are behind the same proxies.
            if (this.options.trustProxy === undefined && this.httpOptions.trustProxy !== undefined) {
                this.options = { ...this.options, trustProxy: this.httpOptions.trustProxy };
            }
        }

        this.registerContainerBindings();
        await this.registerImplementations();
        const events = await this.generateEvents();

        this.adapter = await this.context.container.resolve<WebSocketAdapter>(WEBSOCKET_ADAPTER);
        this.adapter.initialize?.(this.options.useHttpPluginServer ? this.httpAdapter.getHttpServer() : undefined);
        this.adapter.registerEvents(events);
        await this.logger.info(`Plugin registered`);
    }

    private registerContainerBindings(): void {
        this.context.container.bind({ token: WEBSOCKET_OPTIONS, useValue: this.options });
        this.context.container.bind({ token: WEBSOCKET_ADAPTER, useClass: this.options.adapter, scope: InjectableScopes.Singleton });
        this.context.container.bind({ token: WEBSOCKET_LOGGER, useValue: this.logger });
    }

    private async registerImplementations(): Promise<void> {
        ResultProcessor.registerResult(ExecutionTransport.WebSocket, await this.injector.get(WebSocketResultResolver));
        if (this.options.timeout) {
            TimeoutGenerator.registerTimeout(ExecutionTransport.WebSocket, this.options.timeoutOptions?.time);
        }
        // The resolver is always registered, so the `@Timeout()` of an event works without a default timeout.
        TimeoutProcessor.registerTimeout(ExecutionTransport.WebSocket, await this.injector.get(WebSocketTimeoutResolver));

        ParameterGenerator.registerParameter(WebSocketParameter.Connection, await this.injector.get(WsConnectionResolver));
        ParameterGenerator.registerParameter(WebSocketParameter.Message, await this.injector.get(WsMessageResolver));
        ParameterGenerator.registerParameter(WebSocketParameter.Data, await this.injector.get(WsDataResolver));
        ParameterGenerator.registerParameter(WebSocketParameter.Ack, await this.injector.get(WsAckResolver));
    }

    private async generateEvents(): Promise<WebSocketEventDefinition[]> {
        const eventGenerator = await this.injector.get(WebSocketEventGenerator);
        return await eventGenerator.generate();
    }

    async onStart(): Promise<void> {
        await this.adapter.start();
        await this.logger.info(
            `Plugin started. WebSockets opened on path ${this.options.path} with port ${this.options.useHttpPluginServer ? this.httpOptions.port : this.options.port}`
        );
    }

    async onStop(): Promise<void> {
        await this.adapter.stop();
        await this.logger.info(`Plugin stopped`);
    }
}
