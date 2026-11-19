import { IncrementalCleanup } from '../incremental-cleanup';
import { CacheStore } from './cache-store';

interface CacheEntry {
    value: unknown;
    expiresAt?: number;
}

/** The default maximum number of values of an `InMemoryCacheStore`. */
export const DEFAULT_CACHE_MAX_ENTRIES = 10_000;

/**
 * Options of the in-memory cache store.
 */
export interface InMemoryCacheStoreOptions {
    /**
     * The maximum number of values kept in memory. When a new value exceeds it, the least recently used value is removed. Defaults to
     * 10 000; `Infinity` keeps every value until it expires.
     */
    maxEntries?: number;
}

/**
 * Keeps the cached values in memory. The values are local to the application process and are stored as they are, without serializing them.
 * The expired values are removed when they are read, and a few of them are examined on each write, so the cleanup never scans the whole
 * map at once. The least recently used values are removed when the store reaches `maxEntries`, so the memory is bounded however many
 * different keys are cached.
 */
export class InMemoryCacheStore implements CacheStore {
    // The order of the map is the order of use: a value is moved to the end when it is read or written, so the first one is the least recently used.
    private readonly entries = new Map<string, CacheEntry>();
    private readonly maxEntries: number;
    private readonly cleanup = new IncrementalCleanup(this.entries, (entry: CacheEntry, now: number) => this.isExpired(entry, now));

    constructor(options: InMemoryCacheStoreOptions = {}) {
        this.maxEntries = Math.max(1, options.maxEntries ?? DEFAULT_CACHE_MAX_ENTRIES);
    }

    public async get<T>(key: string): Promise<T | undefined> {
        const entry = this.entries.get(key);
        if (!entry) return undefined;

        this.entries.delete(key);
        if (this.isExpired(entry, Date.now())) return undefined;

        this.entries.set(key, entry);
        return entry.value as T;
    }

    public async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
        const now = Date.now();
        this.entries.delete(key);
        this.entries.set(key, { value, expiresAt: ttlMs === undefined ? undefined : now + ttlMs });
        if (this.entries.size > this.maxEntries) this.entries.delete(this.entries.keys().next().value as string);

        this.cleanup.step(now);
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
}
