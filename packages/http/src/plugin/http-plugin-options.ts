import { PluginOptions } from '@axisparkjs/core';
import { HttpAdapterClass } from '../adapter/http-adapter';
import { VersionType } from '../version';
import { HttpRequest } from '../types';

/**
 * Options for configuring the header-based version resolver.
 */
export interface HeaderVersionOptions {
    type: VersionType.Header;
    header: string;
}

/**
 * Options for configuring the media type-based version resolver.
 */
export interface MediaTypeVersionOptions {
    type: VersionType.MediaType;
    key: string;
}

/**
 * Options for configuring the URI-based version resolver.
 */
export interface UriVersionOptions {
    type: VersionType.Uri;
    defaultVersion?: string;
}

/**
 * Options for configuring the custom version resolver.
 */
export interface CustomVersionOptions {
    type: VersionType.Custom;
    resolver: (req: HttpRequest) => string | undefined;
}

/**
 * A union type for all possible version options.
 */
export type VersionOptions = HeaderVersionOptions | MediaTypeVersionOptions | UriVersionOptions | CustomVersionOptions;

/**
 * Options for configuring the timeout behavior.
 */
export interface TimeoutOptions {
    /**
     * The timeout duration in milliseconds.
     */
    time: number;
    /**
     * The message to display when a timeout occurs. By default, it will display a generic timeout message.
     */
    message?: string | ((time: number) => string);
}

/**
 * Options for configuring HTTP rate limiting.
 */
export interface RateLimitOptions {
    /** The sliding time window in milliseconds. */
    ttl: number;
    /** The maximum number of requests allowed in the window. */
    limit: number;
    /** The response message when a client exceeds the limit. The function receives milliseconds until the oldest request expires. */
    message?: string | ((time: number) => string);
}

/** Severity to apply to a route compatibility finding. */
export type RouteValidationAction = 'error' | 'warn' | 'ignore';

/** Options for validating declared HTTP routes during plugin registration. */
export interface RouteValidationOptions {
    /** Action for routes with the same method and normalized path. @default 'warn' */
    onDuplicate?: RouteValidationAction;
    /** Action for overlapping static and dynamic path segments. @default 'warn' */
    onAmbiguous?: RouteValidationAction;
    /** Action for routes shadowed by an earlier wildcard route. @default 'warn' */
    onUnreachable?: RouteValidationAction;
}

/**
 * Options for configuring the HTTP plugin.
 */
export interface HttpPluginOptions extends PluginOptions {
    /** Whether to validate route compatibility during plugin registration. Defaults to true. */
    routeValidation?: boolean;
    /** Actions to apply to each kind of route compatibility finding. */
    routeValidationOptions?: RouteValidationOptions;
    /**
     * The port on which the HTTP server will listen.
     */
    port: number;
    /**
     * The base path for the HTTP server.
     */
    basePath: string;
    /**
     * The HTTP adapter to use. Express or Fastify are supported.
     */
    adapter: HttpAdapterClass;
    /**
     * Whether to use the body parser middleware.
     */
    bodyParser: boolean;
    /**
     * Options for configuring the body parser middleware.
     */
    bodyParserOptions?: any;
    /**
     * Whether to use the URL-encoded middleware.
     */
    urlEncoded?: boolean;
    /**
     * Options for configuring the URL-encoded middleware.
     */
    urlEncodedOptions?: any;
    /**
     * Whether to use CORS middleware.
     */
    cors: boolean;
    /**
     * Options for configuring the CORS middleware.
     */
    corsOptions?: any;
    /**
     * Whether to use the session middleware.
     */
    session: boolean;
    /**
     * Options for configuring the session middleware.
     */
    sessionOptions?: any;
    /**
     * Whether to use the cookie parser middleware.
     */
    cookies: boolean;
    /**
     * Options for configuring the cookie parser middleware.
     */
    cookiesOptions?: any;
    /**
     * Whether to use compression middleware.
     */
    compression: boolean;
    /**
     * Options for configuring the compression middleware.
     */
    compressionOptions?: any;
    /**
     * Whether to use the timeout middleware.
     */
    timeout: boolean;
    /**
     * Options for configuring the timeout middleware.
     */
    timeoutOptions?: TimeoutOptions;
    /** Whether to use HTTP rate limiting. Disabled by default. */
    rateLimit?: boolean;
    /** Default rate limits applied to endpoints without decorator overrides. */
    rateLimitOptions?: RateLimitOptions;
    /**
     * Whether to use the versioning guard.
     */
    version: boolean;
    /**
     * Options for configuring the versioning guard.
     */
    versionOptions?: VersionOptions;
    /**
     * Whether to use the health check endpoints.
     */
    healthChecks?: boolean;
    /**
     * Whether to log HTTP requests.
     */
    logHttpRequests?: boolean;
    /**
     * Whether to log HTTP responses.
     */
    logHttpResponses?: boolean;
    /**
     * Whether to log HTTP errors.
     */
    logHttpErrors?: boolean;
    /**
     * Whether to log all errors.
     */
    logErrors?: boolean;
}
