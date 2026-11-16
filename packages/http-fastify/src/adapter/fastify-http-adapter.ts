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
import { stat } from 'node:fs/promises';
import os from 'node:os';

/**
 * An HTTP adapter for integrating Fastify with the HTTP Plugin.
 */
@Injectable()
export class FastifyHttpAdapter implements HttpAdapter {
    private readonly app: FastifyInstance;
    private readonly registeredRoutes: RouteDefinition[] = [];
    private readonly responseSchemas = new WeakMap<RouteDefinition, Readonly<Record<string, object>>>();

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
        await this.registerStaticFiles();
        if (this.options.cookies) await this.app.register(cookie, this.options.cookiesOptions ?? {});
        if (this.options.session) await this.app.register(session, this.options.sessionOptions);
        if (this.options.compression) await this.app.register(compress, this.options.compressionOptions ?? {});
        if (this.options.cors) await this.app.register(cors, this.options.corsOptions ?? {});
        if (this.options.urlEncoded) await this.app.register(formbody, this.options.urlEncodedOptions ?? {});
        if (this.options.fileUpload) await this.app.register(multipart);
    }

    /**
     * Registers `@fastify/static`. The file results need its `reply.sendFile()`, so it is always registered, but it only serves the static
     * files folder when `staticFiles` is `true`, or when it is not set and the folder exists.
     */
    private async registerStaticFiles(): Promise<void> {
        const root = path.resolve(this.axisparkConfig.basePath || process.cwd(), this.options.staticFilesOptions?.root ?? 'public');
        const serve = this.options.staticFiles ?? (await FastifyHttpAdapter.isDirectory(root));
        if (!serve) {
            await this.app.register(fastifyStatic, { serve: false });
            return;
        }

        await this.app.register(fastifyStatic, { root, prefix: this.options.staticFilesOptions?.prefix ?? '/' });
    }

    private static async isDirectory(folder: string): Promise<boolean> {
        try {
            return (await stat(folder)).isDirectory();
        } catch {
            return false;
        }
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
                    await route.handler(this.createContext(request, reply, this.responseSchemas.get(route)));
                    // Some replies, such as files and streams, are sent after the handler ends: returning the reply makes Fastify wait for them instead of sending an empty reply.
                    return reply;
                }
            });
        }
    }

    /**
     * Keeps the JSON schemas of the responses of a route, so its JSON responses are serialized with `fast-json-stringify` (the serializer
     * compiler of Fastify) instead of `JSON.stringify`. The schemas are compiled the first time they are used, and cached by Fastify.
     * @param route A route registered with `registerRoutes()`.
     * @param schemas The self-contained JSON schemas of the responses, by status code (`'default'` for any other status).
     */
    registerResponseSchemas(route: RouteDefinition, schemas: Readonly<Record<string, object>>): void {
        this.responseSchemas.set(route, schemas);
    }

    private createContext(request: FastifyRequest, reply: FastifyReply, schemas?: Readonly<Record<string, object>>) {
        const req = new FastifyHttpRequest(request, reply.raw);
        const res = new FastifyHttpResponse(reply, schemas);
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
