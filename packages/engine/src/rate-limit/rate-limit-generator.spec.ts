import { Metadata } from '@axisparkjs/common';
import { ExecutionContext, ExecutionTransport } from '../execution';
import { RateLimitMetadata } from '../metadata';
import { RateLimitDefinition } from './rate-limit-definition';
import { RateLimitGenerator } from './rate-limit-generator';

describe('RateLimitGenerator', () => {
    let generator: RateLimitGenerator;
    const target = class TestController {};
    const context = (transport = ExecutionTransport.Http, propertyKey: string | symbol = 'handle'): ExecutionContext =>
        ({ target, propertyKey, transport }) as ExecutionContext;

    beforeEach(() => {
        generator = new RateLimitGenerator();
        (RateLimitGenerator as any).defaults.clear();
        jest.restoreAllMocks();
    });

    it('returns undefined when no metadata or transport default is configured', () => {
        jest.spyOn(Metadata, 'get').mockReturnValue(undefined);

        expect(generator.generate(context())).toBeUndefined();
    });

    it('uses the registered transport policy', () => {
        jest.spyOn(Metadata, 'get').mockReturnValue(undefined);
        RateLimitGenerator.registerRateLimit(ExecutionTransport.Http, { ttl: 5_000, limit: 7 });

        expect(generator.generate(context())).toEqual(new RateLimitDefinition(5_000, 7));
    });

    it('fills omitted transport defaults with the built-in policy', () => {
        jest.spyOn(Metadata, 'get').mockReturnValue(undefined);
        RateLimitGenerator.registerRateLimit(ExecutionTransport.Http, {});

        expect(generator.generate(context())).toEqual(new RateLimitDefinition(60_000, 100));
    });

    it('gives method options precedence over class options and falls back to transport defaults', () => {
        const classMetadata: RateLimitMetadata = { target, disabled: false, options: { ttl: 3_000, limit: 10 } };
        const methodMetadata: RateLimitMetadata = { target, propertyKey: 'handle', disabled: false, options: { limit: 2 } };
        jest.spyOn(Metadata, 'get').mockImplementation((_key, _target, propertyKey) => (propertyKey ? methodMetadata : classMetadata));
        RateLimitGenerator.registerRateLimit(ExecutionTransport.Http, { ttl: 5_000, limit: 20 });

        expect(generator.generate(context())).toEqual(new RateLimitDefinition(5_000, 2));
    });

    it('uses class metadata when method metadata is absent', () => {
        const classMetadata: RateLimitMetadata = { target, disabled: false, options: { limit: 3 } };
        jest.spyOn(Metadata, 'get').mockImplementation((_key, _target, propertyKey) => (propertyKey ? undefined : classMetadata));
        RateLimitGenerator.registerRateLimit(ExecutionTransport.Http, { ttl: 2_000, limit: 10 });

        expect(generator.generate(context())).toEqual(new RateLimitDefinition(2_000, 3));
    });

    it('returns undefined for a method excluded from rate limiting', () => {
        const methodMetadata: RateLimitMetadata = { target, propertyKey: 'handle', disabled: true };
        jest.spyOn(Metadata, 'get').mockImplementation((_key, _target, propertyKey) => (propertyKey ? methodMetadata : undefined));
        RateLimitGenerator.registerRateLimit(ExecutionTransport.Http, { ttl: 1_000, limit: 1 });

        expect(generator.generate(context())).toBeUndefined();
    });

    it('allows an explicit method policy to override a class exclusion', () => {
        const classMetadata: RateLimitMetadata = { target, disabled: true };
        const methodMetadata: RateLimitMetadata = { target, propertyKey: 'handle', disabled: false, options: { limit: 4 } };
        jest.spyOn(Metadata, 'get').mockImplementation((_key, _target, propertyKey) => (propertyKey ? methodMetadata : classMetadata));

        expect(generator.generate(context())).toEqual(new RateLimitDefinition(60_000, 4));
    });

    it('does not share defaults across transports and can unregister a default', () => {
        jest.spyOn(Metadata, 'get').mockReturnValue(undefined);
        RateLimitGenerator.registerRateLimit(ExecutionTransport.Http, { ttl: 1_000, limit: 1 });

        expect(generator.generate(context(ExecutionTransport.WebSocket))).toBeUndefined();
        RateLimitGenerator.registerRateLimit(ExecutionTransport.Http);
        expect(generator.generate(context())).toBeUndefined();
    });
});
