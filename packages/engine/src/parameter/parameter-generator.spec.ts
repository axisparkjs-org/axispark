import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { ParameterGenerator } from './parameter-generator';
import { ParameterResolver } from './parameter-resolver';
import { ParameterDefinition } from './parameter-definition';
import { ExecutionContext, ExecutionHandler } from '../execution';
import { ParameterMetadata } from '../metadata/parameter-metadata';

describe('ParameterGenerator', () => {
    let generator: ParameterGenerator;

    beforeEach(() => {
        generator = new ParameterGenerator();

        // Clear the static Map between tests.
        (ParameterGenerator as any).resolvers.clear();

        jest.restoreAllMocks();
    });

    describe('registerParameter', () => {
        it('should register a parameter resolver', () => {
            const resolver: ParameterResolver<any> = {
                resolve: jest.fn()
            };

            ParameterGenerator.registerParameter('foo', resolver);

            const executionContext = {} as ExecutionContext;
            const executionHandler = {} as ExecutionHandler;

            const metadata: ParameterMetadata[] = [
                {
                    parameter: 'foo',
                    parameterIndex: 0
                } as ParameterMetadata
            ];

            jest.spyOn(Metadata, 'get').mockReturnValue(metadata);

            generator.generate(executionContext, executionHandler);

            expect(resolver.resolve).toHaveBeenCalledTimes(1);
        });
    });

    describe('generate', () => {
        it('should return an empty array when there is no parameter metadata', () => {
            jest.spyOn(Metadata, 'get').mockReturnValue(undefined);

            const executionContext = {} as ExecutionContext;
            const executionHandler = {} as ExecutionHandler;

            const result = generator.generate(executionContext, executionHandler);

            expect(result).toEqual([]);
        });

        it('should resolve registered parameters', () => {
            const executionContext = {} as ExecutionContext;
            const executionHandler = {} as ExecutionHandler;

            const parameterMetadata = {
                parameter: 'foo',
                parameterIndex: 0
            } as ParameterMetadata;

            const resolvedValue = 'resolved-value';

            const resolver: ParameterResolver<any> = {
                resolve: jest.fn().mockReturnValue(resolvedValue)
            };

            ParameterGenerator.registerParameter('foo', resolver);

            jest.spyOn(Metadata, 'get').mockReturnValue([parameterMetadata]);

            const result = generator.generate(executionContext, executionHandler);

            expect(resolver.resolve).toHaveBeenCalledTimes(1);
            expect(result).toHaveLength(1);
            expect(result[0]).toBeInstanceOf(ParameterDefinition);
            expect(result[0].value).toBe(resolvedValue);
        });

        it('should pass the execution context and parameter to the resolver', () => {
            const executionContext = {} as ExecutionContext;
            const executionHandler = {} as ExecutionHandler;

            const parameterMetadata = {
                parameter: 'foo',
                parameterIndex: 0
            } as ParameterMetadata;

            const resolver: ParameterResolver<any> = {
                resolve: jest.fn().mockReturnValue('value')
            };

            ParameterGenerator.registerParameter('foo', resolver);

            jest.spyOn(Metadata, 'get').mockReturnValue([parameterMetadata]);

            const result = generator.generate(executionContext, executionHandler);

            const generatedParameter = result[0];

            expect(resolver.resolve).toHaveBeenCalledWith(executionContext, generatedParameter);
        });

        it('should set the resolved value on the parameter', () => {
            const executionContext = {} as ExecutionContext;
            const executionHandler = {} as ExecutionHandler;

            const parameterMetadata = {
                parameter: 'foo',
                parameterIndex: 0
            } as ParameterMetadata;

            const parameter = ParameterDefinition.fromMetadata(parameterMetadata);
            const setValueSpy = jest.spyOn(parameter, 'setValue');

            jest.spyOn(ParameterDefinition, 'fromMetadata').mockReturnValue(parameter);

            const resolver: ParameterResolver<any> = {
                resolve: jest.fn().mockReturnValue('resolved-value')
            };

            ParameterGenerator.registerParameter('foo', resolver);

            jest.spyOn(Metadata, 'get').mockReturnValue([parameterMetadata]);

            generator.generate(executionContext, executionHandler);

            expect(setValueSpy).toHaveBeenCalledWith('resolved-value');
        });

        it('should ignore parameters without a registered resolver', () => {
            const executionContext = {} as ExecutionContext;
            const executionHandler = {} as ExecutionHandler;

            const parameterMetadata = {
                parameter: 'unknown',
                parameterIndex: 0
            } as ParameterMetadata;

            jest.spyOn(Metadata, 'get').mockReturnValue([parameterMetadata]);

            const result = generator.generate(executionContext, executionHandler);

            expect(result).toEqual([]);
        });

        it('should preserve the parameter index', () => {
            const executionContext = {} as ExecutionContext;
            const executionHandler = {} as ExecutionHandler;

            const firstMetadata = {
                parameter: 'first',
                parameterIndex: 0
            } as ParameterMetadata;

            const secondMetadata = {
                parameter: 'second',
                parameterIndex: 2
            } as ParameterMetadata;

            const firstResolver: ParameterResolver<any> = {
                resolve: jest.fn().mockReturnValue('first-value')
            };

            const secondResolver: ParameterResolver<any> = {
                resolve: jest.fn().mockReturnValue('second-value')
            };

            ParameterGenerator.registerParameter('first', firstResolver);
            ParameterGenerator.registerParameter('second', secondResolver);

            jest.spyOn(Metadata, 'get').mockReturnValue([firstMetadata, secondMetadata]);

            const result = generator.generate(executionContext, executionHandler);

            expect(result[0].value).toBe('first-value');
            expect(result[1]).toBeUndefined();
            expect(result[2].value).toBe('second-value');
        });

        it('should resolve multiple registered parameters', () => {
            const executionContext = {} as ExecutionContext;
            const executionHandler = {} as ExecutionHandler;

            const metadata: ParameterMetadata[] = [
                {
                    parameter: 'foo',
                    parameterIndex: 0
                } as ParameterMetadata,
                {
                    parameter: 'bar',
                    parameterIndex: 1
                } as ParameterMetadata
            ];

            const fooResolver: ParameterResolver<any> = {
                resolve: jest.fn().mockReturnValue('foo-value')
            };

            const barResolver: ParameterResolver<any> = {
                resolve: jest.fn().mockReturnValue('bar-value')
            };

            ParameterGenerator.registerParameter('foo', fooResolver);
            ParameterGenerator.registerParameter('bar', barResolver);

            jest.spyOn(Metadata, 'get').mockReturnValue(metadata);

            const result = generator.generate(executionContext, executionHandler);

            expect(result).toHaveLength(2);
            expect(result[0].value).toBe('foo-value');
            expect(result[1].value).toBe('bar-value');

            expect(fooResolver.resolve).toHaveBeenCalledTimes(1);
            expect(barResolver.resolve).toHaveBeenCalledTimes(1);
        });

        it('should use the correct metadata keys and target information', () => {
            const executionContext = {} as ExecutionContext;

            const executionHandler = {
                target: class TestTarget {},
                propertyKey: 'testMethod'
            } as ExecutionHandler;

            const getSpy = jest.spyOn(Metadata, 'get').mockReturnValue([]);

            generator.generate(executionContext, executionHandler);

            expect(getSpy).toHaveBeenCalledWith(MetadataKeys.PARAMETER, executionHandler.target, executionHandler.propertyKey);
        });

        it('should generate parameters with resolving set to true', () => {
            const executionContext = {} as ExecutionContext;
            const executionHandler = {} as ExecutionHandler;

            const parameterMetadata = {
                parameter: 'foo',
                parameterIndex: 0
            } as ParameterMetadata;

            const resolver: ParameterResolver<any> = {
                resolve: jest.fn().mockReturnValue('resolved-value')
            };

            ParameterGenerator.registerParameter('foo', resolver);

            jest.spyOn(Metadata, 'get').mockReturnValue([parameterMetadata]);

            const result = generator.generate(executionContext, executionHandler, true);

            expect(resolver.resolve).toHaveBeenCalledTimes(1);
            expect(result).toHaveLength(1);
            expect(result[0]).toBeInstanceOf(ParameterDefinition);
            expect(result[0].value).toBe('resolved-value');
        });

        it('should not resolve parameters when resolving is set to false', () => {
            const executionContext = {} as ExecutionContext;
            const executionHandler = {} as ExecutionHandler;

            const parameterMetadata = {
                parameter: 'foo',
                parameterIndex: 0
            } as ParameterMetadata;

            const resolver: ParameterResolver<any> = {
                resolve: jest.fn().mockReturnValue('resolved-value')
            };

            ParameterGenerator.registerParameter('foo', resolver);

            jest.spyOn(Metadata, 'get').mockReturnValue([parameterMetadata]);

            const result = generator.generate(executionContext, executionHandler, false);

            expect(resolver.resolve).not.toHaveBeenCalled();
            expect(result).toHaveLength(1);
            expect(result[0]).toBeInstanceOf(ParameterDefinition);
            expect(result[0].value).toBeUndefined();
        });
    });
});
