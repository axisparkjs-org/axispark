import { Inject, Injectable } from '@axisparkjs/di';
import { HTTP_OPTIONS, HttpAdapter, RouteDefinition } from '@axisparkjs/http';
import { HttpServer } from '@axisparkjs/common';
import { AxiSparkConfig, AXISPARK_CONFIG } from '@axisparkjs/core';
import { FastifyHttpRequest } from '../types/fastify-http-request';
import { FastifyHttpResponse } from '../types/fastify-http-response';
import { FastifyHttpPluginOptions } from '../plugin/fastify-http-plugin-options';
import { FastifyHttpSession } from '../types/fastify-http-session';
import fastify, { FastifyInstance, FastifyReply, FastifyRequest, FastifyServerOptions } from 'fastify';
import cookie from '@fastify/cookie';
import session from '@fastify/session';
import compress from '@fastify/compress';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import os from 'node:os';

/**
 * An HTTP adapter for integrating Fastify with the HTTP Plugin.
 */
@Injectable()
export class FastifyHttpAdapter implements HttpAdapter {
    private readonly app: FastifyInstance;
    private readonly registeredRoutes: RouteDefinition[] = [];

    constructor(
        @Inject(HTTP_OPTIONS)
        private readonly options: FastifyHttpPluginOptions,
        @Inject(AXISPARK_CONFIG)
        private readonly axisparkConfig: AxiSparkConfig
    ) {
        // Fastify accepts the number of trusted proxies at runtime, although its types do not include numbers.
        this.app = fastify({ trustProxy: (this.options.trustProxy ?? false) as FastifyServerOptions['trustProxy'] });
    }

    async initialize(): Promise<void> {
        await this.app.register(fastifyStatic, {
            root: path.join(this.axisparkConfig.basePath || process.cwd(), 'public')
        });
        if (this.options.cookies) await this.app.register(cookie, this.options.cookiesOptions ?? {});
        if (this.options.session) await this.app.register(session, this.options.sessionOptions);
        if (this.options.compression) await this.app.register(compress, this.options.compressionOptions ?? {});
        if (this.options.cors) await this.app.register(cors, this.options.corsOptions ?? {});
        if (this.options.urlEncoded) await this.app.register(formbody, this.options.urlEncodedOptions ?? {});
        if (this.options.fileUpload) await this.app.register(multipart);
    }

    getRegisteredRoutes(): readonly RouteDefinition[] {
        return this.registeredRoutes;
    }

    getHttpServer(): HttpServer {
        return this.app.server;
    }

    registerRoutes(routes: readonly RouteDefinition[]): void {
        this.registeredRoutes.push(...routes);
        for (const route of routes) {
            const { path, httpMethod } = route;
            this.app.route({
                method: httpMethod.toUpperCase(),
                url: path,
                handler: async (request, reply) => {
                    await route.handler(this.createContext(request, reply));
                    // Some replies, such as files and streams, are sent after the handler ends: returning the reply makes Fastify wait for them instead of sending an empty reply.
                    return reply;
                }
            });
        }
    }

    private createContext(request: FastifyRequest, reply: FastifyReply) {
        const req = new FastifyHttpRequest(request);
        const res = new FastifyHttpResponse(reply);
        const ses = request.session ? new FastifyHttpSession(request.session) : undefined;
        return { request: req, response: res, session: ses };
    }

    /**
     * Starts listening on the configured port and host. Without a host, the server listens on every network interface, as the Express adapter and Node.js do: `::` when IPv6 is available, and `0.0.0.0` otherwise.
     * @returns A promise that resolves when the server is listening, and rejects with the `listen` error, such as `EADDRINUSE`.
     */
    async start(): Promise<void> {
        await this.app.listen({ port: this.options.port, host: this.options.host ?? FastifyHttpAdapter.getDefaultHost() });
    }

    /**
     * Returns the unspecified address used when no host is configured: `::` when a network interface has an IPv6 address, and `0.0.0.0` otherwise.
     * @returns The default host.
     */
    static getDefaultHost(): string {
        const hasIPv6 = Object.values(os.networkInterfaces()).some((addresses) => addresses?.some((address) => address.family === 'IPv6'));
        return hasIPv6 ? '::' : '0.0.0.0';
    }

    async stop(): Promise<void> {
        await this.app.close();
    }
}
