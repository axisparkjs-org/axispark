import { HttpPlugin } from '@axisparkjs/http';
import { ExpressHttpAdapter } from '../adapter/express-http-adapter';
import { HttpPluginOptionsFactory } from './http-plugin-options-factory';

describe('HttpPluginOptionsFactory', () => {
    describe('create', () => {
        it('should return the default options', () => {
            const options = HttpPluginOptionsFactory.create();

            expect(options).toEqual({
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
                logHttpResponses: false
            });
        });

        it('should override the default options', () => {
            const bodyParserOptions = { limit: '10mb' };
            const urlEncodedOptions = { extended: false };
            const sessionOptions = { secret: 'secret' };
            const cookiesOptions = { secret: 'secret' };
            const compressionOptions = { threshold: 1024 };
            const corsOptions = { origin: 'http://example.com' };

            const options = HttpPluginOptionsFactory.create({
                port: 8080,
                basePath: '/',
                bodyParser: false,
                bodyParserOptions,
                urlEncoded: false,
                urlEncodedOptions,
                cors: true,
                corsOptions,
                session: true,
                sessionOptions,
                cookies: true,
                cookiesOptions,
                compression: true,
                compressionOptions,
                healthChecks: true,
                timeout: false,
                timeoutOptions: undefined,
                rateLimit: true,
                rateLimitOptions: {
                    ttl: 10_000,
                    limit: 5
                },
                fileUpload: true,
                fileUploadOptions: {
                    maxFileSize: 1024,
                    maxFiles: 2,
                    allowedMimeTypes: ['image/png']
                },
                version: false,
                versionOptions: undefined,
                logHttpErrors: true,
                logErrors: false,
                logHttpRequests: true,
                logHttpResponses: true
            });

            expect(options).toEqual({
                plugin: HttpPlugin,
                port: 8080,
                basePath: '/',
                adapter: ExpressHttpAdapter,
                bodyParser: false,
                bodyParserOptions,
                urlEncoded: false,
                urlEncodedOptions,
                cors: true,
                corsOptions,
                session: true,
                sessionOptions,
                cookies: true,
                cookiesOptions,
                compression: true,
                compressionOptions,
                healthChecks: true,
                timeout: false,
                timeoutOptions: undefined,
                rateLimit: true,
                rateLimitOptions: {
                    ttl: 10_000,
                    limit: 5
                },
                fileUpload: true,
                fileUploadOptions: {
                    maxFileSize: 1024,
                    maxFiles: 2,
                    allowedMimeTypes: ['image/png']
                },
                version: false,
                versionOptions: undefined,
                logHttpErrors: true,
                logErrors: false,
                logHttpRequests: true,
                logHttpResponses: true
            });
        });

        it('should not mutate the provided options object', () => {
            const input = {
                port: 8080,
                bodyParser: false
            };

            const copy = { ...input };

            HttpPluginOptionsFactory.create(input);

            expect(input).toEqual(copy);
        });

        it('should always include HttpPlugin as plugin', () => {
            const options = HttpPluginOptionsFactory.create({
                port: 4000
            });

            expect(options.plugin).toBe(HttpPlugin);
        });
    });
});
