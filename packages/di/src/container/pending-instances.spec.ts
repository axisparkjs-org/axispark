import { CircularDependencyError } from '../errors';
import { PendingInstances } from './pending-instances';
import { ResolutionChain } from './resolution-chain';

class Service {}

describe('PendingInstances', () => {
    it('should throw a CircularDependencyError when the chain waits for an instance created by one of its ancestors', async () => {
        const pending = new PendingInstances();
        const chain = ResolutionChain.start();
        const key = {};

        const creation = pending.getOrCreate(key, Service, chain, async () => {
            await expect(pending.getOrCreate(key, Service, chain.fork(), async () => new Service())).rejects.toThrow(CircularDependencyError);
            return new Service();
        });

        await expect(creation).resolves.toBeInstanceOf(Service);
    });

    it('should share the instance with a chain that does not create it', async () => {
        const pending = new PendingInstances();
        const key = {};
        let release: () => void = () => undefined;
        const instance = new Service();

        const first = pending.getOrCreate(key, Service, ResolutionChain.start(), () => new Promise((resolve) => (release = () => resolve(instance))));
        const second = pending.getOrCreate(key, Service, ResolutionChain.start(), async () => new Service());
        release();

        await expect(Promise.all([first, second])).resolves.toEqual([instance, instance]);
    });
});
