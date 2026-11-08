import { RedisStoreConnection, toRedisTtl } from './redis-store-connection';
import { RedisStoreConnectionNotFoundError, RedisStoreConnectionNotReadyError } from './redis-store-errors';

describe('RedisStoreConnection', () => {
    it('adds the prefix to the keys', () => {
        const connection = new RedisStoreConnection('MAIN', {} as any, 'app:lock:');

        expect(connection.key('job')).toBe('app:lock:job');
    });

    it('returns the client when it is ready', () => {
        const client = { isReady: true } as any;

        expect(new RedisStoreConnection('MAIN', client, '').ready()).toBe(client);
    });

    it('rejects the operations while the client is not ready', () => {
        const connection = new RedisStoreConnection('MAIN', { isReady: false } as any, '');

        expect(() => connection.ready()).toThrow(RedisStoreConnectionNotReadyError);
        expect(() => connection.ready()).toThrow(`The Redis connection 'MAIN' used by the store is not ready.`);
    });
});

describe('toRedisTtl', () => {
    it.each([
        [1_000, 1_000],
        [1.2, 2],
        [0, 1],
        [-5, 1]
    ])('converts %p to %p milliseconds', (ttl, expected) => {
        expect(toRedisTtl(ttl)).toBe(expected);
    });
});

describe('Redis store errors', () => {
    it('names the errors', () => {
        expect(new RedisStoreConnectionNotFoundError('MAIN').name).toBe('RedisStoreConnectionNotFoundError');
        expect(new RedisStoreConnectionNotReadyError('MAIN').name).toBe('RedisStoreConnectionNotReadyError');
    });
});
