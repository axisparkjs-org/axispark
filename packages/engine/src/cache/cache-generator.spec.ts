import { Metadata } from '@axisparkjs/common';
import { ExecutionContext, ExecutionTransport } from '../execution';
import { CacheMetadata } from '../metadata';
import { CacheDefinition } from './cache-definition';
import { CacheGenerator } from './cache-generator';

describe('CacheGenerator', () => {
    let generator: CacheGenerator;
    const target = class TestController {};
    const context = (transport = ExecutionTransport.Http): ExecutionContext => ({ target, propertyKey: 'handle', transport }) as ExecutionContext;
    const mockMetadata = (methodMetadata?: CacheMetadata, classMetadata?: CacheMetadata) =>
        jest.spyOn(Metadata, 'get').mockImplementation((_key, _target, propertyKey) => (propertyKey ? methodMetadata : classMetadata));

    beforeEach(() => {
        generator = new CacheGenerator();
        (CacheGenerator as any).defaults.clear();
        jest.restoreAllMocks();
    });

    it('does not cache a handler without metadata, even with a transport default', () => {
        mockMetadata();
        CacheGenerator.registerCache(ExecutionTransport.Http, { ttl: 5_000 });

        expect(generator.generate(context())).toBeUndefined();
    });

    it('uses the ttl of the method', () => {
        mockMetadata({ target, propertyKey: 'handle', disabled: false, options: { ttl: 1_000 } });
        CacheGenerator.registerCache(ExecutionTransport.Http, { ttl: 5_000 });

        expect(generator.generate(context())).toEqual(new CacheDefinition(1_000));
    });

    it('falls back to the default ttl of the transport, and then to 60 seconds', () => {
        mockMetadata({ target, propertyKey: 'handle', disabled: false, options: {} });

        expect(generator.generate(context())).toEqual(new CacheDefinition(60_000));
        CacheGenerator.registerCache(ExecutionTransport.Http, { ttl: 5_000 });
        expect(generator.generate(context())).toEqual(new CacheDefinition(5_000));
        expect(generator.generate(context(ExecutionTransport.WebSocket))).toEqual(new CacheDefinition(60_000));
    });

    it('removes the default ttl of a transport', () => {
        mockMetadata({ target, propertyKey: 'handle', disabled: false });
        CacheGenerator.registerCache(ExecutionTransport.Http, { ttl: 5_000 });
        CacheGenerator.registerCache(ExecutionTransport.Http);

        expect(generator.generate(context())).toEqual(new CacheDefinition(60_000));
    });

    it('uses the class metadata when the method has none', () => {
        const key = () => 'key';
        mockMetadata(undefined, { target, disabled: false, options: { ttl: 2_000, key } });

        expect(generator.generate(context())).toEqual(new CacheDefinition(2_000, key));
    });

    it('gives the method options precedence over the class options', () => {
        mockMetadata(
            { target, propertyKey: 'handle', disabled: false, options: { ttl: 1_000 } },
            { target, disabled: false, options: { ttl: 2_000, key: () => 'key' } }
        );

        expect(generator.generate(context())).toEqual(new CacheDefinition(1_000));
    });

    it('lets @NoCache() on a method disable the @Cache() of its class', () => {
        mockMetadata({ target, propertyKey: 'handle', disabled: true }, { target, disabled: false, options: { ttl: 2_000 } });

        expect(generator.generate(context())).toBeUndefined();
    });

    it('lets @Cache() on a method enable the cache of a class with @NoCache()', () => {
        mockMetadata({ target, propertyKey: 'handle', disabled: false, options: { ttl: 1_000 } }, { target, disabled: true });

        expect(generator.generate(context())).toEqual(new CacheDefinition(1_000));
    });

    it('does not cache the handlers of a class with @NoCache()', () => {
        mockMetadata(undefined, { target, disabled: true });

        expect(generator.generate(context())).toBeUndefined();
    });
});
