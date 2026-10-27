import { Factory } from '@axisparkjs/common';
import { HttpPlugin } from '@axisparkjs/http';
import { ExpressHttpAdapter } from '../adapter/express-http-adapter';
import { ExpressHttpPluginOptions } from './express-http-plugin-options';

/**
 * A factory class for creating default Express HTTP plugin options. This class implements the Factory interface and provides a method to create an instance of ExpressHttpPluginOptions with default values, allowing for optional overrides.
 */
export class HttpPluginOptionsFactoryStatic implements Factory<ExpressHttpPluginOptions> {
    create(options?: Partial<Omit<ExpressHttpPluginOptions, 'plugin' | 'adapter'>>): ExpressHttpPluginOptions {
        return {
            plugin: HttpPlugin,
            port: 3000,
            basePath: '/',
            adapter: ExpressHttpAdapter,
            bodyParser: true,
            bodyParserOptions: undefined,
            urlEncoded: true,
            urlEncodedOptions: undefined,
            cors: false,
            corsOptions: undefined,
            session: false,
            sessionOptions: undefined,
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
