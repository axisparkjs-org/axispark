import { VersionProcessor } from './version-processor';
import { VersionDefinition } from './version-definition';
import { VersionType } from './version-type';
import { VersionResolver } from './version-resolver';
import { HttpPluginOptions } from '../plugin/http-plugin-options';
import { HttpContext } from '../types';

describe('VersionProcessor', () => {
    const createVersionDefinition = (acceptedVersions: string[] = []) => {
        const definition = new VersionDefinition();
        definition.setAcceptedVersions(acceptedVersions);
        return definition;
    };

    const request = {} as any;

    const createContext = (): HttpContext => ({
        request,
        response: {} as any,
        session: {} as any,
        target: class TestController {},
        propertyKey: 'test',
        scopedContainer: {} as any,
        transport: {} as any,
        host: undefined,
        version: undefined,
        error: undefined
    });

    const createProcessor = (versionOptions?: HttpPluginOptions['versionOptions']) => {
        return new VersionProcessor({
            adapter: class TestAdapter {},
            port: 3000,
            versionOptions
        } as HttpPluginOptions);
    };

    beforeEach(() => {
        // VersionProcessor.resolvers es static, por lo que limpiamos
        // el estado entre tests.
        (VersionProcessor as any).resolvers.clear();
    });

    describe('registerVersion', () => {
        it('should register a resolver for a version type', () => {
            const resolver: VersionResolver = {
                resolve: jest.fn().mockReturnValue('1')
            };

            VersionProcessor.registerVersion(VersionType.Header, resolver);

            const processor = createProcessor({
                type: VersionType.Header
            } as any);

            const version = createVersionDefinition(['1']);
            const context = createContext();

            processor.process(version, context);

            expect(resolver.resolve).toHaveBeenCalledTimes(1);
            expect(resolver.resolve).toHaveBeenCalledWith(
                request,
                expect.objectContaining({
                    type: VersionType.Header
                })
            );
        });

        it('should replace an existing resolver for the same type', () => {
            const firstResolver: VersionResolver = {
                resolve: jest.fn().mockReturnValue('1')
            };

            const secondResolver: VersionResolver = {
                resolve: jest.fn().mockReturnValue('2')
            };

            VersionProcessor.registerVersion(VersionType.Header, firstResolver);

            VersionProcessor.registerVersion(VersionType.Header, secondResolver);

            const processor = createProcessor({
                type: VersionType.Header
            } as any);

            const version = createVersionDefinition(['1', '2']);
            const context = createContext();

            processor.process(version, context);

            expect(firstResolver.resolve).not.toHaveBeenCalled();
            expect(secondResolver.resolve).toHaveBeenCalledTimes(1);
            expect(version.version).toBe('2');
        });
    });

    describe('process', () => {
        it('should do nothing when version options are not configured', () => {
            const processor = createProcessor();

            const version = createVersionDefinition(['1']);
            const context = createContext();

            processor.process(version, context);

            expect(version.version).toBeUndefined();
        });

        it('should do nothing when version options have no type', () => {
            const processor = createProcessor({} as any);

            const version = createVersionDefinition(['1']);
            const context = createContext();

            processor.process(version, context);

            expect(version.version).toBeUndefined();
        });

        it('should do nothing when the version definition is undefined', () => {
            const resolver: VersionResolver = {
                resolve: jest.fn()
            };

            VersionProcessor.registerVersion(VersionType.Header, resolver);

            const processor = createProcessor({
                type: VersionType.Header
            } as any);

            const context = createContext();

            processor.process(undefined, context);

            expect(resolver.resolve).not.toHaveBeenCalled();
        });

        it('should resolve the version using the registered resolver', () => {
            const resolver: VersionResolver = {
                resolve: jest.fn().mockReturnValue('2')
            };

            VersionProcessor.registerVersion(VersionType.Header, resolver);

            const options = {
                type: VersionType.Header
            } as any;

            const processor = createProcessor(options);

            const version = createVersionDefinition(['1', '2']);
            const context = createContext();

            processor.process(version, context);

            expect(resolver.resolve).toHaveBeenCalledTimes(1);
            expect(resolver.resolve).toHaveBeenCalledWith(request, options);
        });

        it('should set the resolved version on the version definition', () => {
            const resolver: VersionResolver = {
                resolve: jest.fn().mockReturnValue('2')
            };

            VersionProcessor.registerVersion(VersionType.Header, resolver);

            const processor = createProcessor({
                type: VersionType.Header
            } as any);

            const version = createVersionDefinition(['1', '2']);
            const context = createContext();

            processor.process(version, context);

            expect(version.version).toBe('2');
        });

        it('should not modify the context version', () => {
            const resolver: VersionResolver = {
                resolve: jest.fn().mockReturnValue('2')
            };

            VersionProcessor.registerVersion(VersionType.Header, resolver);

            const processor = createProcessor({
                type: VersionType.Header
            } as any);

            const version = createVersionDefinition(['1', '2']);
            const context = createContext();

            processor.process(version, context);

            expect(context.version).toBeUndefined();
        });

        it('should set version to undefined when the resolver does not resolve a version', () => {
            const resolver: VersionResolver = {
                resolve: jest.fn().mockReturnValue(undefined)
            };

            VersionProcessor.registerVersion(VersionType.Header, resolver);

            const processor = createProcessor({
                type: VersionType.Header
            } as any);

            const version = createVersionDefinition(['1', '2']);
            const context = createContext();

            processor.process(version, context);

            expect(version.version).toBeUndefined();
            expect(context.version).toBeUndefined();
        });

        it('should not throw when no resolver is registered', () => {
            const processor = createProcessor({
                type: VersionType.Header
            } as any);

            const version = createVersionDefinition(['1', '2']);
            const context = createContext();

            expect(() => {
                processor.process(version, context);
            }).not.toThrow();

            expect(version.version).toBeUndefined();
        });

        it('should use the request from the context', () => {
            const resolver: VersionResolver = {
                resolve: jest.fn().mockReturnValue('1')
            };

            VersionProcessor.registerVersion(VersionType.Header, resolver);

            const processor = createProcessor({
                type: VersionType.Header
            } as any);

            const context = createContext();

            processor.process(createVersionDefinition(['1']), context);

            expect(resolver.resolve).toHaveBeenCalledWith(context.request, expect.anything());
        });

        it('should use the configured version options', () => {
            const resolver: VersionResolver = {
                resolve: jest.fn().mockReturnValue('1')
            };

            VersionProcessor.registerVersion(VersionType.Header, resolver);

            const options = {
                type: VersionType.Header,
                defaultVersion: '1'
            } as any;

            const processor = createProcessor(options);
            const context = createContext();
            const version = createVersionDefinition(['1']);

            processor.process(version, context);

            expect(resolver.resolve).toHaveBeenCalledWith(context.request, options);
        });

        it('should not use a resolver registered for another version type', () => {
            const headerResolver: VersionResolver = {
                resolve: jest.fn().mockReturnValue('1')
            };

            const uriResolver: VersionResolver = {
                resolve: jest.fn().mockReturnValue('2')
            };

            VersionProcessor.registerVersion(VersionType.Header, headerResolver);

            VersionProcessor.registerVersion(VersionType.Uri, uriResolver);

            const processor = createProcessor({
                type: VersionType.Uri
            } as any);

            const version = createVersionDefinition(['1', '2']);
            const context = createContext();

            processor.process(version, context);

            expect(headerResolver.resolve).not.toHaveBeenCalled();
            expect(uriResolver.resolve).toHaveBeenCalledTimes(1);
            expect(version.version).toBe('2');
        });

        it('should support different registered version types', () => {
            const headerResolver: VersionResolver = {
                resolve: jest.fn().mockReturnValue('1')
            };

            const uriResolver: VersionResolver = {
                resolve: jest.fn().mockReturnValue('2')
            };

            VersionProcessor.registerVersion(VersionType.Header, headerResolver);

            VersionProcessor.registerVersion(VersionType.Uri, uriResolver);

            const processor = createProcessor({
                type: VersionType.Uri
            } as any);

            const version = createVersionDefinition(['1', '2']);
            const context = createContext();

            processor.process(version, context);

            expect(headerResolver.resolve).not.toHaveBeenCalled();
            expect(uriResolver.resolve).toHaveBeenCalled();
            expect(version.version).toBe('2');
        });
    });
});
