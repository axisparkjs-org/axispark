import { Factory } from '@axisparkjs/common';
import { HttpPlugin } from '@axisparkjs/http';
import { FastifyHttpAdapter } from '../adapter/fastify-http-adapter';
import { FastifyHttpPluginOptions } from './fastify-http-plugin-options';

/**
 * A factory class for creating default Fastify HTTP plugin options. This class implements the Factory interface and provides a method to create an instance of FastifyHttpPluginOptions with default values, allowing for optional overrides.
 */
export class HttpPluginOptionsFactoryStatic implements Factory<FastifyHttpPluginOptions> {
    create(options?: Partial<Omit<FastifyHttpPluginOptions, 'plugin' | 'adapter'>>): FastifyHttpPluginOptions {
        return {
            plugin: HttpPlugin,
            port: 3000,
            basePath: '/',
            adapter: FastifyHttpAdapter,
            bodyParser: false,
            urlEncoded: true,
            urlEncodedOptions: undefined,
            cors: false,
            corsOptions: undefined,
            session: false,
            sessionOptions: {
                secret: 'secret'
            },
            cookies: true,
            cookiesOptions: undefined,
            compression: false,
            compressionOptions: undefined,
            healthChecks: false,
            timeout: true,
            timeoutOptions: {
                time: 5000
            },
            rateLimit: false,
            rateLimitOptions: {
                ttl: 60_000,
                limit: 100
            },
            fileUpload: false,
            fileUploadOptions: {
                maxFileSize: 5 * 1024 * 1024,
                maxFiles: 10
            },
            version: false,
            versionOptions: undefined,
            logHttpErrors: false,
            logErrors: true,
            logHttpRequests: false,
            logHttpResponses: false,
            ...options
        };
    }
}

export const HttpPluginOptionsFactory = new HttpPluginOptionsFactoryStatic();
