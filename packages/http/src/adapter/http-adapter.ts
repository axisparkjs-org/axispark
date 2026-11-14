import { HttpServer } from '@axisparkjs/common';
import { RouteDefinition } from '../routes/route-definition';

/**
 * An interface representing an HTTP adapter.
 * It defines the contract for handling HTTP-related operations.
 */
export interface HttpAdapter {
    /**
     * Registers the provided routes with the adapter.
     * @param routes An array of route definitions to be registered.
     * @returns A promise that resolves when the routes have been registered, or void if the operation is synchronous.
     */
    registerRoutes(routes: readonly RouteDefinition[]): void | Promise<void>;
    /**
     * Retrieves the registered routes from the adapter.
     * @returns An array of route definitions that have been registered with the adapter.
     */
    getRegisteredRoutes(): readonly RouteDefinition[];
    /**
     * Retrieves the underlying HTTP server instance used by the adapter.
     * @returns The HTTP server instance, which can be of type `http.Server`, `https.Server`, `http2.Http2Server`, or `http2.Http2SecureServer`.
     */
    getHttpServer(): HttpServer;
    /**
     * Registers the JSON schemas of the responses of a route, by status code (`'default'` for any other status), so the adapter can
     * serialize the responses with them. Optional: the adapters that do not support it serialize every response with `JSON.stringify`.
     * The OpenAPI plugin calls it with the schemas of the document when its `serializeResponses` option is enabled.
     * @param route A route returned by `getRegisteredRoutes()`.
     * @param schemas The self-contained JSON schemas of the responses of the route, by status code.
     */
    registerResponseSchemas?(route: RouteDefinition, schemas: Readonly<Record<string, object>>): void;
    /**
     * Initializes the HTTP adapter.
     * @returns A promise that resolves when the adapter has been initialized, or void if the operation is synchronous.
     */
    initialize?(): void | Promise<void>;
    /**
     * Starts the HTTP adapter.
     * @returns A promise that resolves when the adapter has been started, or void if the operation is synchronous.
     */
    start(): void | Promise<void>;
    /**
     * Stops the HTTP adapter.
     * @returns A promise that resolves when the adapter has been stopped, or void if the operation is synchronous.
     */
    stop(): void | Promise<void>;
}
/**
 * A type representing a class that implements the `HttpAdapter` interface.
 */
export type HttpAdapterClass<T extends HttpAdapter = HttpAdapter> = new (...args: any[]) => T;
