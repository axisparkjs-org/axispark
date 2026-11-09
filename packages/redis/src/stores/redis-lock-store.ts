import { randomUUID } from 'node:crypto';
import { Lock, LockStore } from '@axisparkjs/store';
import { RedisStoreConnection, toRedisTtl } from './redis-store-connection';

/** Deletes the lock only when it still has the token of the owner. */
const RELEASE_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0
`;

/** Sets a new expiration for the lock only when it still has the token of the owner. */
const EXTEND_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('PEXPIRE', KEYS[1], ARGV[2]) end
return 0
`;

/**
 * Stores the locks in Redis, so they coordinate every instance of the application connected to the same Redis.
 * A lock is a key with the random token of its owner and an expiration (`SET NX PX`), and it is released and extended with
 * scripts that compare the token, so an instance never releases a lock that expired and was acquired by another instance.
 */
export class RedisLockStore implements LockStore {
    constructor(private readonly connection: RedisStoreConnection) {}

    public async acquire(key: string, ttlMs: number): Promise<Lock | undefined> {
        const token = randomUUID();
        const redisKey = this.connection.key(key);
        const reply = await this.connection.ready().set(redisKey, token, {
            condition: 'NX',
            expiration: { type: 'PX', value: toRedisTtl(ttlMs) }
        });
        if (reply !== 'OK') return undefined;

        return {
            key,
            token,
            release: async () => (await this.run(RELEASE_SCRIPT, redisKey, [token])) === 1,
            extend: async (newTtlMs: number) => (await this.run(EXTEND_SCRIPT, redisKey, [token, String(toRedisTtl(newTtlMs))])) === 1
        };
    }

    private async run(script: string, key: string, args: string[]): Promise<number> {
        return Number(await this.connection.ready().eval(script, { keys: [key], arguments: args }));
    }
}
