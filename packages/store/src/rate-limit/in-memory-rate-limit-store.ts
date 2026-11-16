import { RateLimitDecision } from './rate-limit-decision';
import { RateLimitPolicy, RateLimitStore } from './rate-limit-store';

/** The counters of a key: the requests of the current fixed window and of the previous one. */
interface RateLimitBucket {
    /** The start of the current window, a multiple of `ttl`. */
    window: number;
    current: number;
    previous: number;
    ttl: number;
}

/**
 * Keeps the rate limit buckets in memory with a sliding window counter: each bucket counts the requests of the current fixed window of
 * `ttl` milliseconds and of the previous one, and estimates the requests of the sliding window as `previous * (1 - elapsed / ttl) + current`.
 * It takes constant time and memory per client and handler, whatever the limit, at the cost of an approximation: the requests of the
 * previous window are taken as spread evenly over it. The buckets are local to the application process, and the expired ones are removed
 * every 256 checks.
 */
export class InMemoryRateLimitStore implements RateLimitStore {
    private static readonly CLEANUP_INTERVAL = 256;

    private readonly buckets = new Map<string, RateLimitBucket>();
    private checkedRequests = 0;

    public consume(key: string, policy: RateLimitPolicy): RateLimitDecision {
        const now = Date.now();
        this.checkedRequests++;
        if (this.checkedRequests % InMemoryRateLimitStore.CLEANUP_INTERVAL === 0) this.removeExpiredBuckets(now);

        const { ttl, limit } = policy;
        if (limit <= 0 || ttl <= 0) return limit <= 0 ? { allowed: false, retryAfterMs: Math.max(ttl, 0) } : { allowed: true, retryAfterMs: 0 };

        const bucket = this.currentBucket(key, ttl, now);
        const elapsed = now - bucket.window;
        const estimated = bucket.previous * (1 - elapsed / ttl) + bucket.current;
        if (estimated + 1 <= limit) {
            bucket.current++;
            return { allowed: true, retryAfterMs: 0 };
        }

        return { allowed: false, retryAfterMs: InMemoryRateLimitStore.retryAfter(bucket, limit, elapsed) };
    }

    /** The number of buckets that are currently stored. */
    public get size(): number {
        return this.buckets.size;
    }

    /* The bucket of the key, moved to the window of now. */
    private currentBucket(key: string, ttl: number, now: number): RateLimitBucket {
        const window = Math.floor(now / ttl) * ttl;
        let bucket = this.buckets.get(key);
        if (!bucket || bucket.ttl !== ttl) {
            bucket = { window, current: 0, previous: 0, ttl };
            this.buckets.set(key, bucket);
        } else if (bucket.window !== window) {
            bucket.previous = window - bucket.window === ttl ? bucket.current : 0;
            bucket.current = 0;
            bucket.window = window;
        }
        return bucket;
    }

    /* The time until the estimated requests leave room for one more request. */
    private static retryAfter(bucket: RateLimitBucket, limit: number, elapsed: number): number {
        const { ttl, previous, current } = bucket;
        // In the current window, the estimation decreases while the previous window leaves the sliding window.
        if (current <= limit - 1 && previous > 0) {
            return Math.max(Math.ceil(ttl * (1 - (limit - 1 - current) / previous) - elapsed), 1);
        }
        // Otherwise the current window must end, and then its requests must leave the sliding window too.
        const inNextWindow = Math.max(Math.ceil(ttl * (1 - (limit - 1) / current)), 0);
        return ttl - elapsed + inNextWindow;
    }

    private removeExpiredBuckets(now: number): void {
        for (const [key, bucket] of this.buckets) {
            // A bucket whose current window ended before the previous window of now has no request in the sliding window.
            if (now - bucket.window >= 2 * bucket.ttl) this.buckets.delete(key);
        }
    }
}
