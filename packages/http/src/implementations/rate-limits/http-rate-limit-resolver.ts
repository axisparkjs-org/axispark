import { Injectable } from '@axisparkjs/di';
import { ExecutionContext, RateLimitDecision, RateLimitDefinition, RateLimitResolver } from '@axisparkjs/engine';
import { HttpContext } from '../../types';

export type { RateLimitDecision } from '@axisparkjs/engine';

interface RateLimitBucket {
    timestamps: number[];
    ttl: number;
}

/** Resolves HTTP rate limits using the client IP and endpoint as the bucket key. */
@Injectable()
export class HttpRateLimitResolver implements RateLimitResolver {
    private readonly buckets = new Map<string, RateLimitBucket>();
    private checkedRequests = 0;

    public resolve(definition: RateLimitDefinition, context: ExecutionContext): RateLimitDecision {
        const httpContext = context as HttpContext;
        const endpoint = `${httpContext.request.method}:${httpContext.request.path}:${context.target.name}.${String(context.propertyKey)}`;
        return this.consume(httpContext.request.ip, endpoint, definition);
    }

    private consume(clientIp: string | undefined, endpoint: string, definition: RateLimitDefinition): RateLimitDecision {
        const now = Date.now();
        const key = JSON.stringify([clientIp ?? 'unknown', endpoint]);
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
        if (this.checkedRequests % 256 === 0) this.removeExpiredBuckets(now);

        return decision;
    }

    private removeExpiredBuckets(now: number): void {
        for (const [key, bucket] of this.buckets) {
            bucket.timestamps = bucket.timestamps.filter((timestamp) => timestamp > now - bucket.ttl);
            if (bucket.timestamps.length === 0) this.buckets.delete(key);
        }
    }
}
