import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { InjectionToken } from '@axisparkjs/di';
import { InjectRedisConnection, REDIS_LOGGER, REDIS_OPTIONS, redisConnectionToken } from './tokens';

describe('Redis injection tokens', () => {
    it('exports stable tokens for plugin options and logger', () => {
        expect(REDIS_OPTIONS.description).toBe('REDIS_OPTIONS');
        expect(REDIS_LOGGER.description).toBe('REDIS_LOGGER');
    });

    it('creates the token of a named connection', () => {
        expect(redisConnectionToken('CACHE')).toEqual(new InjectionToken('REDIS_CONNECTION_CACHE'));
    });

    it('creates an injection decorator for the named Redis connection', () => {
        const connectionDecorator = InjectRedisConnection('CACHE');
        class SessionCache {}
        connectionDecorator(SessionCache, undefined, 0);
        const metadata = Metadata.get<{ params: Map<number, { description: string }> }>(MetadataKeys.INJECT, SessionCache);

        expect(metadata?.params.get(0)?.description).toBe('REDIS_CONNECTION_CACHE');
    });
});
