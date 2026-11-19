import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { InjectRedisConnection, REDIS_LOGGER, REDIS_OPTIONS, redisConnectionToken } from './tokens';

describe('Redis injection tokens', () => {
    it('exports stable tokens for plugin options and logger', () => {
        expect(REDIS_OPTIONS.description).toBe('REDIS_OPTIONS');
        expect(REDIS_LOGGER.description).toBe('REDIS_LOGGER');
    });

    it('creates the token of a named connection', () => {
        expect(redisConnectionToken('CACHE').description).toBe('REDIS_CONNECTION_CACHE');
    });

    it('returns the same token instance for the same connection name', () => {
        expect(redisConnectionToken('CACHE')).toBe(redisConnectionToken('CACHE'));
        expect(redisConnectionToken('CACHE')).not.toBe(redisConnectionToken('LOCKS'));
    });

    it('creates an injection decorator for the named Redis connection', () => {
        const connectionDecorator = InjectRedisConnection('CACHE');
        class SessionCache {}
        connectionDecorator(SessionCache, undefined, 0);
        const metadata = Metadata.get<{ params: Map<number, { description: string }> }>(MetadataKeys.INJECT, SessionCache);

        expect(metadata?.params.get(0)).toBe(redisConnectionToken('CACHE'));
    });
});
