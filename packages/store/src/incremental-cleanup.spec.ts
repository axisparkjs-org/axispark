import { CLEANUP_STEP, IncrementalCleanup } from './incremental-cleanup';

describe('IncrementalCleanup', () => {
    const expiredAt = (map: Map<string, number>) => new IncrementalCleanup(map, (expiresAt: number, now: number) => expiresAt <= now);

    it('examines at most CLEANUP_STEP entries per step, continuing from the previous step', () => {
        const entries = new Map(Array.from({ length: CLEANUP_STEP * 3 }, (_, index) => [`key-${index}`, index] as [string, number]));
        const isExpired = jest.fn().mockReturnValue(false);
        const cleanup = new IncrementalCleanup(entries, isExpired);

        cleanup.step(1);
        cleanup.step(1);

        expect(isExpired).toHaveBeenCalledTimes(CLEANUP_STEP * 2);
        expect(isExpired.mock.calls.map(([value]) => value)).toEqual(Array.from({ length: CLEANUP_STEP * 2 }, (_, index) => index));
    });

    it('removes the expired entries and starts again from the first entry at the end of the map', () => {
        const entries = new Map([
            ['old', 5],
            ['new', 100]
        ]);
        const cleanup = expiredAt(entries);

        cleanup.step(10);
        expect([...entries.keys()]).toEqual(['new']);

        entries.set('later', 20);
        cleanup.step(50);
        expect([...entries.keys()]).toEqual(['new']);
    });

    it('ends when the step empties the map, and does nothing with an empty map', () => {
        const entries = new Map([
            ['a', 1],
            ['b', 1]
        ]);
        const cleanup = expiredAt(entries);

        cleanup.step(10);
        expect(entries.size).toBe(0);
        expect(() => cleanup.step(10)).not.toThrow();
    });

    it('examines each entry of a small map at most twice per step', () => {
        const entries = new Map([['only', 100]]);
        const isExpired = jest.fn().mockReturnValue(false);

        new IncrementalCleanup(entries, isExpired).step(0);

        expect(isExpired.mock.calls.length).toBeLessThanOrEqual(2);
    });
});
