import { RateLimitDecision } from './rate-limit-decision';
import { RateLimitPolicy, RateLimitStore } from './rate-limit-store';

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

    public consume(key: string, policy: RateLimitPolicy): RateLimitDecision {
        const now = Date.now();
        const bucket = this.buckets.get(key) ?? { timestamps: [], ttl: policy.ttl };
        const cutoff = now - policy.ttl;
        bucket.timestamps = bucket.timestamps.filter((timestamp) => timestamp > cutoff);
        bucket.ttl = policy.ttl;

        let decision: RateLimitDecision;
        if (policy.limit <= 0 || bucket.timestamps.length >= policy.limit) {
            const oldest = bucket.timestamps[0];
            decision = {
                allowed: false,
                retryAfterMs: oldest === undefined ? Math.max(policy.ttl, 0) : Math.max(oldest + policy.ttl - now, 0)
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
