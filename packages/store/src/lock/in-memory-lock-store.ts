import { randomUUID } from 'node:crypto';
import { Lock, LockStore } from './lock-store';

interface LockEntry {
    token: string;
    expiresAt: number;
}

/**
 * Keeps the locks in memory. The locks are local to the application process, so they only coordinate the code of one instance.
 * The expired locks are removed when their key is acquired again and every 256 acquisitions.
 */
export class InMemoryLockStore implements LockStore {
    private static readonly CLEANUP_INTERVAL = 256;

    private readonly locks = new Map<string, LockEntry>();
    private acquisitions = 0;

    public async acquire(key: string, ttlMs: number): Promise<Lock | undefined> {
        const now = Date.now();
        this.acquisitions++;
        if (this.acquisitions % InMemoryLockStore.CLEANUP_INTERVAL === 0) this.removeExpiredLocks(now);

        const current = this.locks.get(key);
        if (current && current.expiresAt > now) return undefined;

        const token = randomUUID();
        this.locks.set(key, { token, expiresAt: now + ttlMs });

        return {
            key,
            token,
            release: async () => this.release(key, token),
            extend: async (newTtlMs: number) => this.extend(key, token, newTtlMs)
        };
    }

    /** The number of locks that are currently stored, including the expired ones that were not removed yet. */
    public get size(): number {
        return this.locks.size;
    }

    private release(key: string, token: string): boolean {
        if (!this.isOwned(key, token)) return false;

        this.locks.delete(key);
        return true;
    }

    private extend(key: string, token: string, ttlMs: number): boolean {
        if (!this.isOwned(key, token)) return false;

        this.locks.set(key, { token, expiresAt: Date.now() + ttlMs });
        return true;
    }

    private isOwned(key: string, token: string): boolean {
        const current = this.locks.get(key);
        return current !== undefined && current.token === token && current.expiresAt > Date.now();
    }

    private removeExpiredLocks(now: number): void {
        for (const [key, lock] of this.locks) {
            if (lock.expiresAt <= now) this.locks.delete(key);
        }
    }
}
