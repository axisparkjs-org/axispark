import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { ExecutionContext, ExecutionTransport } from '../execution';
import { TimeoutMetadata } from '../metadata';
import { TimeoutDefinition } from './timeout-definition';
import { TimeoutGenerator } from './timeout-generator';
import { NoTimeout, Timeout } from '../decorators';

describe('TimeoutGenerator', () => {
    let generator: TimeoutGenerator;

    beforeEach(() => {
        generator = new TimeoutGenerator();
        jest.restoreAllMocks();
    });

    describe('registerTimeout', () => {
        it('should register the provided timeout for a transport', () => {
            TimeoutGenerator.registerTimeout(ExecutionTransport.Http, 5000);

            const context = {
                target: class {},
                propertyKey: 'test',
                transport: ExecutionTransport.Http
            } as ExecutionContext;

            jest.spyOn(Metadata, 'get').mockReturnValue(undefined);

            const result = generator.generate(context);

            expect(result).toBeInstanceOf(TimeoutDefinition);
            expect(result).toEqual(new TimeoutDefinition(5000));
        });

        it('should use the default timeout when no time is provided', () => {
            TimeoutGenerator.registerTimeout(ExecutionTransport.Http);

            const context = {
                target: class {},
                propertyKey: 'test',
                transport: ExecutionTransport.Http
            } as ExecutionContext;

            jest.spyOn(Metadata, 'get').mockReturnValue(undefined);

            const result = generator.generate(context);

            expect(result).toBeInstanceOf(TimeoutDefinition);
            expect(result).toEqual(new TimeoutDefinition(10000));
        });
    });

    describe('generate', () => {
        it('should return a Timeout using method metadata', () => {
            const target = class {};
            const methodMetadata: TimeoutMetadata = { time: 3000, target: {} as any };

            jest.spyOn(Metadata, 'get').mockImplementation((_key, _target, propertyKey) => (propertyKey === 'test' ? methodMetadata : undefined));

            const context = {
                target,
                propertyKey: 'test',
                transport: ExecutionTransport.Http
            } as ExecutionContext;

            const result = generator.generate(context);

            expect(result).toEqual(new TimeoutDefinition(3000));
        });

        it('should give method metadata precedence over class metadata', () => {
            const target = class {};
            const classMetadata: TimeoutMetadata = { time: 5000, target: {} as any };
            const methodMetadata: TimeoutMetadata = { time: 3000, target: {} as any };

            jest.spyOn(Metadata, 'get').mockImplementation((_key, _target, propertyKey) => (propertyKey === 'test' ? methodMetadata : classMetadata));

            const context = {
                target,
                propertyKey: 'test',
                transport: ExecutionTransport.Http
            } as ExecutionContext;

            const result = generator.generate(context);

            expect(result).toEqual(new TimeoutDefinition(3000));
        });

        it('should use class metadata when method metadata is not defined', () => {
            const target = class {};
            const classMetadata: TimeoutMetadata = { time: 5000, target: {} as any };

            jest.spyOn(Metadata, 'get').mockImplementation((_key, _target, propertyKey) => (propertyKey === 'test' ? undefined : classMetadata));

            const context = {
                target,
                propertyKey: 'test',
                transport: ExecutionTransport.Http
            } as ExecutionContext;

            const result = generator.generate(context);

            expect(result).toEqual(new TimeoutDefinition(5000));
        });

        it('should use the registered transport timeout when metadata is not defined', () => {
            TimeoutGenerator.registerTimeout(ExecutionTransport.Http, 7000);

            jest.spyOn(Metadata, 'get').mockReturnValue(undefined);

            const context = {
                target: class {},
                propertyKey: 'test',
                transport: ExecutionTransport.Http
            } as ExecutionContext;

            const result = generator.generate(context);

            expect(result).toEqual(new TimeoutDefinition(7000));
        });

        it('should return undefined when no metadata or transport timeout exists', () => {
            jest.spyOn(Metadata, 'get').mockReturnValue(undefined);

            const context = {
                target: class {},
                propertyKey: 'test',
                transport: ExecutionTransport.All
            } as ExecutionContext;

            const result = generator.generate(context);

            expect(result).toBeUndefined();
        });

        it('should use a timeout of 0 when explicitly configured', () => {
            const target = class {};
            const methodMetadata: TimeoutMetadata = { time: 0, target: {} as any };

            jest.spyOn(Metadata, 'get').mockImplementation((_key, _target, propertyKey) => (propertyKey === 'test' ? methodMetadata : undefined));

            const context = {
                target,
                propertyKey: 'test',
                transport: ExecutionTransport.Http
            } as ExecutionContext;

            const result = generator.generate(context);

            expect(result).toEqual(new TimeoutDefinition(0));
        });

        describe('when the timeout is disabled', () => {
            const context = (target: object) =>
                ({
                    target,
                    propertyKey: 'test',
                    transport: ExecutionTransport.Http
                }) as ExecutionContext;

            beforeEach(() => {
                TimeoutGenerator.registerTimeout(ExecutionTransport.Http, 300);
            });

            it('should return undefined when the method is disabled by @NoTimeout()', () => {
                const methodMetadata: TimeoutMetadata = { disabled: true, target: {} as any };

                jest.spyOn(Metadata, 'get').mockImplementation((_key, _target, propertyKey) => (propertyKey === 'test' ? methodMetadata : undefined));

                expect(generator.generate(context(class {}))).toBeUndefined();
            });

            it('should give a disabled method precedence over the timeout of its class', () => {
                const classMetadata: TimeoutMetadata = { time: 5000, target: {} as any };
                const methodMetadata: TimeoutMetadata = { disabled: true, target: {} as any };

                jest.spyOn(Metadata, 'get').mockImplementation((_key, _target, propertyKey) => (propertyKey === 'test' ? methodMetadata : classMetadata));

                expect(generator.generate(context(class {}))).toBeUndefined();
            });

            it('should return undefined for every handler of a class disabled by @NoTimeout()', () => {
                const classMetadata: TimeoutMetadata = { disabled: true, target: {} as any };

                jest.spyOn(Metadata, 'get').mockImplementation((_key, _target, propertyKey) => (propertyKey === 'test' ? undefined : classMetadata));

                expect(generator.generate(context(class {}))).toBeUndefined();
            });

            it('should give the timeout of a method precedence over a disabled class', () => {
                const classMetadata: TimeoutMetadata = { disabled: true, target: {} as any };
                const methodMetadata: TimeoutMetadata = { time: 2000, target: {} as any };

                jest.spyOn(Metadata, 'get').mockImplementation((_key, _target, propertyKey) => (propertyKey === 'test' ? methodMetadata : classMetadata));

                expect(generator.generate(context(class {}))).toEqual(new TimeoutDefinition(2000));
            });

            it('should return undefined for a negative time defined by previous versions of @NoTimeout()', () => {
                const methodMetadata: TimeoutMetadata = { time: -1, target: {} as any };

                jest.spyOn(Metadata, 'get').mockImplementation((_key, _target, propertyKey) => (propertyKey === 'test' ? methodMetadata : undefined));

                expect(generator.generate(context(class {}))).toBeUndefined();
            });

            it('should disable the timeout with the real @NoTimeout() decorator on a method and on a class', () => {
                class MethodTarget {
                    @NoTimeout()
                    test() {}
                }

                @NoTimeout()
                class ClassTarget {
                    test() {}
                }

                @NoTimeout()
                class OverriddenTarget {
                    @Timeout(1000)
                    test() {}
                }

                expect(generator.generate(context(MethodTarget))).toBeUndefined();
                expect(generator.generate(context(ClassTarget))).toBeUndefined();
                expect(generator.generate(context(OverriddenTarget))).toEqual(new TimeoutDefinition(1000));
            });
        });

        it('should call Metadata.get with the expected arguments', () => {
            const target = class {};
            const propertyKey = 'test';
            const transport = ExecutionTransport.Http;

            const getSpy = jest.spyOn(Metadata, 'get').mockReturnValue(undefined);

            const context = {
                target,
                propertyKey,
                transport
            } as ExecutionContext;

            generator.generate(context);

            expect(getSpy).toHaveBeenNthCalledWith(1, MetadataKeys.TIMEOUT, target);

            expect(getSpy).toHaveBeenNthCalledWith(2, MetadataKeys.TIMEOUT, target, propertyKey);
        });
    });
});
