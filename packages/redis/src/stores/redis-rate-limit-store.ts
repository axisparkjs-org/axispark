import { randomUUID } from 'node:crypto';
import { RateLimitDecision, RateLimitPolicy, RateLimitStore } from '@axisparkjs/store';
import { RedisStoreConnection } from './redis-store-connection';

/**
 * Applies the sliding window in one atomic script. Each bucket is a sorted set with one member per counted request, scored with
 * the time of the request. The time is read from the Redis server, so the instances of the application share the same clock.
 * Returns `{ allowed, retryAfterMs }` with `allowed` as `1` or `0`.
 */
const CONSUME_SCRIPT = `
local key = KEYS[1]
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)

redis.call('ZREMRANGEBYSCORE', key, '-inf', now - ttl)
local count = redis.call('ZCARD', key)

if limit <= 0 or count >= limit then
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    if oldest[2] then return {0, math.max(tonumber(oldest[2]) + ttl - now, 0)} end
    return {0, math.max(ttl, 0)}
end

redis.call('ZADD', key, now, now .. ':' .. ARGV[3])
redis.call('PEXPIRE', key, math.max(ttl, 1))
return {1, 0}
`;

/**
 * Counts the rate limit requests in Redis with the same sliding window as `InMemoryRateLimitStore`, so every instance of the
 * application connected to the same Redis shares the limits. The buckets expire with their window.
 */
export class RedisRateLimitStore implements RateLimitStore {
    constructor(private readonly connection: RedisStoreConnection) {}

    public async consume(key: string, policy: RateLimitPolicy): Promise<RateLimitDecision> {
        const reply = (await this.connection.ready().eval(CONSUME_SCRIPT, {
            keys: [this.connection.key(key)],
            arguments: [String(Math.ceil(policy.ttl)), String(policy.limit), randomUUID()]
        })) as [number, number];

        return { allowed: reply[0] === 1, retryAfterMs: Number(reply[1]) };
    }
}
