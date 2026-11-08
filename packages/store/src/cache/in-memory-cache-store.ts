import { CacheStore } from './cache-store';

interface CacheEntry {
    value: unknown;
    expiresAt?: number;
}

/**
 * Keeps the cached values in memory. The values are local to the application process and are stored as they are, without serializing them.
 * The expired values are removed when they are read and every 256 writes.
 */
export class InMemoryCacheStore implements CacheStore {
    private static readonly CLEANUP_INTERVAL = 256;

    private readonly entries = new Map<string, CacheEntry>();
    private writes = 0;

    public async get<T>(key: string): Promise<T | undefined> {
        const entry = this.entries.get(key);
        if (!entry) return undefined;

        if (this.isExpired(entry, Date.now())) {
            this.entries.delete(key);
            return undefined;
        }

        return entry.value as T;
    }

    public async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
        const now = Date.now();
        this.entries.set(key, { value, expiresAt: ttlMs === undefined ? undefined : now + ttlMs });

        this.writes++;
        if (this.writes % InMemoryCacheStore.CLEANUP_INTERVAL === 0) this.removeExpiredEntries(now);
    }

    public async delete(key: string): Promise<void> {
        this.entries.delete(key);
    }

    /** The number of values that are currently stored, including the expired ones that were not removed yet. */
    public get size(): number {
        return this.entries.size;
    }

    private isExpired(entry: CacheEntry, now: number): boolean {
        return entry.expiresAt !== undefined && entry.expiresAt <= now;
    }

    private removeExpiredEntries(now: number): void {
        for (const [key, entry] of this.entries) {
            if (this.isExpired(entry, now)) this.entries.delete(key);
        }
    }
}
