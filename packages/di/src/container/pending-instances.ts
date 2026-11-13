import { ClassType } from '@axisparkjs/common';
import { CircularDependencyError } from '../errors';
import { PendingInstance, ResolutionChain } from './resolution-chain';

/**
 * Keeps the instances that are being created, so concurrent resolutions of the same provider wait for the same promise and receive the same instance. An instance is removed when it is created or when its creation fails, so the next resolution tries again instead of receiving the cached rejection.
 */
export class PendingInstances {
    private readonly pending = new Map<object, PendingInstance>();

    /**
     * Returns the instance of a provider that is being created, or creates it.
     * @template T - The type of the instance.
     * @param key The key of the instance, usually its provider.
     * @param classType The class of the instance, used in the error messages.
     * @param chain The resolution chain that needs the instance.
     * @param create Creates the instance when it is not being created yet.
     * @returns A promise that resolves to the instance.
     * @throws {CircularDependencyError} If waiting for the instance would wait for the chain itself.
     */
    async getOrCreate<T>(key: object, classType: ClassType, chain: ResolutionChain, create: () => Promise<T>): Promise<T> {
        const existing = this.pending.get(key) as PendingInstance<T> | undefined;
        if (existing) {
            const cycle = chain.findWaitCycle(existing);
            if (cycle) throw new CircularDependencyError(chain.describe(false, ...cycle));
            return await chain.waitFor(existing);
        }

        const pending = { classType, owner: chain.state } as PendingInstance<T>;
        this.pending.set(key, pending);
        try {
            pending.promise = create();
            return await pending.promise;
        } finally {
            this.pending.delete(key);
        }
    }
}
