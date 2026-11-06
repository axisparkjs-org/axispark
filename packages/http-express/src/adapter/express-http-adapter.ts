import { Inject, Injectable } from '@axisparkjs/di';
import { HTTP_OPTIONS, HttpAdapter, RouteDefinition } from '@axisparkjs/http';
import { HttpServer } from '@axisparkjs/common';
import express, { Request, Response } from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import cors from 'cors';
import { createServer, Server } from 'node:http';
import { ExpressHttpRequest } from '../types/express-http-request';
import { ExpressHttpResponse } from '../types/express-http-response';
import { ExpressHttpPluginOptions } from '../plugin/express-http-plugin-options';
import { ExpressHttpSession } from '../types/express-http-session';

/**
 * An HTTP adapter for integrating Express.js with the HTTP Plugin.
 */
@Injectable()
export class ExpressHttpAdapter implements HttpAdapter {
    /** Milliseconds to wait for the open requests before closing their connections when the server stops. */
    private static readonly FORCE_CLOSE_TIMEOUT = 10_000;

    private readonly app = express();
    private httpServer?: HttpServer;
    private readonly registeredRoutes: RouteDefinition[] = [];

    constructor(
        @Inject(HTTP_OPTIONS)
        private readonly options: ExpressHttpPluginOptions
    ) {}

    async initialize(): Promise<void> {
        this.httpServer = createServer(this.app);
        this.app.set('trust proxy', this.options.trustProxy ?? false);
        if (this.options.bodyParser) this.app.use(express.json(this.options.bodyParserOptions));
        if (this.options.urlEncoded) this.app.use(express.urlencoded(this.options.urlEncodedOptions));
        if (this.options.session) this.app.use(session(this.options.sessionOptions));
        if (this.options.cookies) this.app.use(cookieParser(this.options.cookiesOptions?.secret, this.options.cookiesOptions?.options));
        if (this.options.compression) this.app.use(compression(this.options.compressionOptions));
        if (this.options.cors) this.app.use(cors(this.options.corsOptions));
    }

    getRegisteredRoutes(): readonly RouteDefinition[] {
        return this.registeredRoutes;
    }

    registerRoutes(routes: readonly RouteDefinition[]): void {
        this.registeredRoutes.push(...routes);
        for (const route of routes) {
            const { path, httpMethod } = route;
            this.app[httpMethod](path, async (req, res) => {
                await route.handler(this.createContext(req, res));
            });
        }
    }

    getHttpServer(): HttpServer {
        return this.httpServer as HttpServer;
    }

    private createContext(request: Request, response: Response) {
        const req = new ExpressHttpRequest(request);
        const res = new ExpressHttpResponse(response);
        const ses = request.session ? new ExpressHttpSession(request.session) : undefined;
        return { request: req, response: res, session: ses };
    }

    /**
     * Starts listening on the configured port.
     * @returns A promise that resolves when the server is listening, and rejects with the `listen` error, such as `EADDRINUSE`.
     */
    async start(): Promise<void> {
        const server = this.httpServer;
        if (!server) return;

        await new Promise<void>((resolve, reject) => {
            const onError = (error: Error) => reject(error);
            server.once('error', onError);
            server.listen(this.options.port, () => {
                server.off('error', onError);
                resolve();
            });
        });
    }

    /**
     * Stops the server. The idle keep-alive connections are closed immediately, and the connections that are still
     * handling a request are closed after 10 seconds.
     * @returns A promise that resolves when the server is closed.
     */
    async stop(): Promise<void> {
        const server = this.httpServer;
        if (!server?.listening) return;

        await new Promise<void>((resolve, reject) => {
            const forceClose = setTimeout(() => (server as Server).closeAllConnections?.(), ExpressHttpAdapter.FORCE_CLOSE_TIMEOUT);
            forceClose.unref();

            server.close((error?: Error) => {
                clearTimeout(forceClose);
                if (error) reject(error);
                else resolve();
            });
            (server as Server).closeIdleConnections?.();
        });
    }
}
