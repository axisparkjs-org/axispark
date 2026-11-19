/** The number of entries examined by each operation of an in-memory store. */
export const CLEANUP_STEP = 8;

/**
 * Removes the expired entries of a map a few at a time: each call examines at most `CLEANUP_STEP` entries, continuing from where the
 * previous call stopped and starting again from the first entry when it reaches the end. The stores call it on each operation, so the
 * expired entries are removed without scanning the whole map at once, which would block the event loop with large maps.
 * @internal
 */
export class IncrementalCleanup<K, V> {
    private cursor?: MapIterator<[K, V]>;

    /**
     * @param entries The map to clean. Its iterators are live, so entries added or removed between two calls are taken into account.
     * @param isExpired Checks an entry, and can update it; the entries for which it returns `true` are removed.
     */
    constructor(
        private readonly entries: Map<K, V>,
        private readonly isExpired: (value: V, now: number) => boolean
    ) {}

    /** Examines the next entries of the map and removes the expired ones. */
    step(now: number): void {
        if (this.entries.size === 0) return;

        let restarted = false;
        for (let examined = 0; examined < CLEANUP_STEP; examined++) {
            this.cursor ??= this.entries.entries();
            const next = this.cursor.next();
            if (next.done) {
                // The end of the map: the next entry is the first one again, at most once per call, so a map emptied by this call ends it.
                this.cursor = undefined;
                if (restarted || this.entries.size === 0) return;
                restarted = true;
                examined--;
                continue;
            }

            const [key, value] = next.value;
            if (this.isExpired(value, now)) this.entries.delete(key);
        }
    }
}
