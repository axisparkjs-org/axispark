import { Inject, Injectable } from '@axisparkjs/di';
import { HTTP_OPTIONS } from '../../di';
import { HttpPluginOptions, RateLimitOptions } from '../../plugin/http-plugin-options';

const DEFAULT_TTL = 60_000;
const DEFAULT_LIMIT = 100;
const DEFAULT_MESSAGE = 'Too many requests. Please try again later.';

interface RateLimitBucket {
    timestamps: number[];
    ttl: number;
}

export interface RateLimitDecision {
    allowed: boolean;
    retryAfterMs: number;
}

/** Keeps per-client request timestamps and enforces a sliding-window limit. */
@Injectable()
export class HttpRateLimitResolver {
    private readonly buckets = new Map<string, RateLimitBucket>();
    private readonly options: RateLimitOptions | undefined;
    private checkedRequests = 0;

    constructor(@Inject(HTTP_OPTIONS) httpOptions: HttpPluginOptions) {
        this.options = httpOptions.rateLimitOptions;
    }

    /** Checks and records a request for one client and endpoint. */
    consume(clientIp: string | undefined, endpoint: string, overrides?: Partial<Pick<RateLimitOptions, 'ttl' | 'limit'>>): RateLimitDecision {
        const ttl = overrides?.ttl ?? this.options?.ttl ?? DEFAULT_TTL;
        const limit = overrides?.limit ?? this.options?.limit ?? DEFAULT_LIMIT;
        const now = Date.now();
        const key = JSON.stringify([clientIp ?? 'unknown', endpoint]);
        const bucket = this.buckets.get(key) ?? { timestamps: [], ttl };
        const cutoff = now - ttl;
        bucket.timestamps = bucket.timestamps.filter((timestamp) => timestamp > cutoff);
        bucket.ttl = ttl;

        let decision: RateLimitDecision;
        if (limit <= 0 || bucket.timestamps.length >= limit) {
            const oldest = bucket.timestamps[0];
            decision = {
                allowed: false,
                retryAfterMs: oldest === undefined ? Math.max(ttl, 0) : Math.max(oldest + ttl - now, 0)
            };
        } else {
            bucket.timestamps.push(now);
            decision = { allowed: true, retryAfterMs: 0 };
        }

        if (bucket.timestamps.length) this.buckets.set(key, bucket);
        else this.buckets.delete(key);

        this.checkedRequests++;
        if (this.checkedRequests % 256 === 0) this.removeExpiredBuckets(now);

        return decision;
    }

    /** Resolves the configured error message for a rejected request. */
    getMessage(retryAfterMs: number): string {
        const message = this.options?.message;
        if (typeof message === 'function') return message(retryAfterMs);
        return message ?? DEFAULT_MESSAGE;
    }

    private removeExpiredBuckets(now: number): void {
        for (const [key, bucket] of this.buckets) {
            bucket.timestamps = bucket.timestamps.filter((timestamp) => timestamp > now - bucket.ttl);
            if (bucket.timestamps.length === 0) this.buckets.delete(key);
        }
    }
}
