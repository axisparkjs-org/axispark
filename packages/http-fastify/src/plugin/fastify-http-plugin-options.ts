import { HttpPluginOptions } from '@axisparkjs/http';
import { FastifyCompressOptions } from '@fastify/compress';
import { FastifyCookieOptions } from '@fastify/cookie';
import { FastifySessionOptions } from '@fastify/session';
import { FastifyFormbodyOptions } from '@fastify/formbody';
import { FastifyCorsOptions } from '@fastify/cors';

/**
 * The options of the static files served by the Fastify adapter.
 */
export interface FastifyStaticFilesOptions {
    /** The folder of the static files. Relative paths are resolved from the `basePath` of the application. Defaults to `public`. */
    root?: string;
    /** The URL prefix of the static files. Defaults to `/`. */
    prefix?: string;
}

/**
 * An interface extending the base HttpPluginOptions to include additional configuration options specific to the Fastify HTTP plugin. This includes options for body parsing, URL encoding, CORS, session management, cookie parsing, and response compression.
 */
export interface FastifyHttpPluginOptions extends HttpPluginOptions {
    bodyParser: false;
    bodyParserOptions?: never;
    urlEncodedOptions?: FastifyFormbodyOptions;
    corsOptions?: FastifyCorsOptions;
    sessionOptions: FastifySessionOptions;
    cookiesOptions?: FastifyCookieOptions;
    compressionOptions?: FastifyCompressOptions;
    /**
     * Whether to serve the static files of `staticFilesOptions.root` (`<basePath>/public` by default). When it is not set, they are
     * served only when the folder exists, so API-only applications do not register a static route. `false` never serves them.
     */
    staticFiles?: boolean;
    /** The options of the static files. */
    staticFilesOptions?: FastifyStaticFilesOptions;
}
