import { RateLimitDecision } from './rate-limit-decision';
import { RateLimitDefinition } from './rate-limit-definition';

/**
 * Stores the requests counted by `RateLimitProcessor` and applies the sliding window of a definition.
 * Implement it to share the limits between several instances of the application, for example in Redis.
 */
export interface RateLimitStore {
    /**
     * Counts a request in the bucket of the key when the limit of the definition allows it.
     * @param key The bucket key, which identifies the transport, the client and the handler.
     * @param definition The time window (`ttl`) and the maximum number of requests (`limit`).
     * @returns Whether the request is allowed and, when it is not, the milliseconds until the oldest request leaves the window.
     */
    consume(key: string, definition: RateLimitDefinition): RateLimitDecision | Promise<RateLimitDecision>;
}

interface RateLimitBucket {
    timestamps: number[];
    ttl: number;
}

/**
 * Keeps the rate limit buckets in memory with a sliding window. The buckets are local to the application process,
 * and the expired ones are removed every 256 checks.
 */
export class InMemoryRateLimitStore implements RateLimitStore {
    private static readonly CLEANUP_INTERVAL = 256;

    private readonly buckets = new Map<string, RateLimitBucket>();
    private checkedRequests = 0;

    public consume(key: string, definition: RateLimitDefinition): RateLimitDecision {
        const now = Date.now();
        const bucket = this.buckets.get(key) ?? { timestamps: [], ttl: definition.ttl };
        const cutoff = now - definition.ttl;
        bucket.timestamps = bucket.timestamps.filter((timestamp) => timestamp > cutoff);
        bucket.ttl = definition.ttl;

        let decision: RateLimitDecision;
        if (definition.limit <= 0 || bucket.timestamps.length >= definition.limit) {
            const oldest = bucket.timestamps[0];
            decision = {
                allowed: false,
                retryAfterMs: oldest === undefined ? Math.max(definition.ttl, 0) : Math.max(oldest + definition.ttl - now, 0)
            };
        } else {
            bucket.timestamps.push(now);
            decision = { allowed: true, retryAfterMs: 0 };
        }

        if (bucket.timestamps.length) this.buckets.set(key, bucket);
        else this.buckets.delete(key);

        this.checkedRequests++;
        if (this.checkedRequests % InMemoryRateLimitStore.CLEANUP_INTERVAL === 0) this.removeExpiredBuckets(now);

        return decision;
    }

    /** The number of buckets that are currently stored. */
    public get size(): number {
        return this.buckets.size;
    }

    private removeExpiredBuckets(now: number): void {
        for (const [key, bucket] of this.buckets) {
            bucket.timestamps = bucket.timestamps.filter((timestamp) => timestamp > now - bucket.ttl);
            if (bucket.timestamps.length === 0) this.buckets.delete(key);
        }
    }
}
