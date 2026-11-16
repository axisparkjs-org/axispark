import { InjectableScopes } from '../types';
import { PendingInstance, ResolutionChain } from './resolution-chain';

class A {}
class B {}
class C {}

const pendingOf = (classType: any, chain: ResolutionChain): PendingInstance => ({ classType, owner: chain.state, promise: Promise.resolve() });

describe('ResolutionChain', () => {
    it('should fork a chain with the same steps and its own state linked to the parent', () => {
        const chain = ResolutionChain.start().with({ classType: A, scope: InjectableScopes.Singleton });

        const fork = chain.fork();

        expect(fork.steps).toEqual(chain.steps);
        expect(fork.state).not.toBe(chain.state);
        expect(fork.state.parent).toBe(chain.state);
        expect(chain.state.forks.has(fork.state)).toBe(true);
        expect(fork.includes(A)).toBe(true);
        expect(fork.hasSingleton()).toBe(true);
    });

    it('should not find a cycle when a fork waits for an instance created by another fork of the same chain', () => {
        const chain = ResolutionChain.start();
        const first = chain.fork();
        const second = chain.fork();

        expect(second.findWaitCycle(pendingOf(A, first))).toBeUndefined();
    });

    it('should find a cycle when a fork waits for an instance created by one of its ancestors', () => {
        const chain = ResolutionChain.start();
        const fork = chain.fork().fork();

        expect(fork.findWaitCycle(pendingOf(A, chain))).toEqual([A]);
    });

    it('should find a cycle through the instances that the forks of another chain wait for', async () => {
        const mine = ResolutionChain.start();
        const other = ResolutionChain.start();
        const otherFork = other.fork();
        const minePending = pendingOf(B, mine);
        const waiting = otherFork.waitFor(minePending);

        expect(mine.findWaitCycle(pendingOf(A, other))).toEqual([A, B]);
        await waiting;
        expect(mine.findWaitCycle(pendingOf(A, other))).toBeUndefined();
    });

    it('should stop at the instances already visited', () => {
        const mine = ResolutionChain.start();
        const first = ResolutionChain.start();
        const second = ResolutionChain.start();
        const firstPending = pendingOf(A, first);
        const secondPending = pendingOf(C, second);
        void first.waitFor(secondPending);
        void second.waitFor(firstPending);

        expect(mine.findWaitCycle(firstPending)).toBeUndefined();
    });

    it('should start an empty chain', () => {
        const chain = ResolutionChain.start();

        expect(chain.steps).toEqual([]);
        expect(chain.includes(A)).toBe(false);
        expect(chain.hasSingleton()).toBe(false);
        expect(chain.describe(false, A)).toBe('A');
    });

    it('should link the dependencies without changing the parent chain', () => {
        const root = ResolutionChain.start().with({ classType: A, scope: InjectableScopes.Transient });
        const left = root.with({ classType: B, scope: InjectableScopes.Scoped });
        const right = root.with({ classType: C, scope: InjectableScopes.Singleton });

        expect(root.steps).toEqual([{ classType: A, scope: InjectableScopes.Transient }]);
        expect(left.steps.map((step) => step.classType)).toEqual([A, B]);
        expect(right.includes(A)).toBe(true);
        expect(right.includes(B)).toBe(false);
        expect(left.includes(C)).toBe(false);
        expect(left.state).toBe(root.state);
    });

    it('should know whether a singleton is in the chain', () => {
        const transient = ResolutionChain.start().with({ classType: A, scope: InjectableScopes.Transient });
        const singleton = transient.with({ classType: B, scope: InjectableScopes.Singleton });

        expect(transient.hasSingleton()).toBe(false);
        expect(singleton.hasSingleton()).toBe(true);
        expect(singleton.with({ classType: C, scope: InjectableScopes.Scoped }).hasSingleton()).toBe(true);
    });

    it('should describe the classes of the chain in order, with their scopes', () => {
        const chain = ResolutionChain.start().with({ classType: A, scope: InjectableScopes.Singleton }).with({ classType: B, scope: InjectableScopes.Scoped });

        expect(chain.describe(true)).toBe('A (singleton) -> B (scoped)');
        expect(chain.describe(false, C)).toBe('A -> B -> C');
    });

    it('should keep the links and the singleton flag of the chain in its forks', () => {
        const chain = ResolutionChain.start()
            .with({ classType: A, scope: InjectableScopes.Singleton })
            .with({ classType: B, scope: InjectableScopes.Transient });

        const fork = chain.fork();

        expect(fork.includes(A)).toBe(true);
        expect(fork.includes(C)).toBe(false);
        expect(fork.hasSingleton()).toBe(true);
        expect(fork.with({ classType: C, scope: InjectableScopes.Scoped }).describe(true)).toBe('A (singleton) -> B (transient) -> C (scoped)');
        expect(ResolutionChain.start().fork().steps).toEqual([]);
    });
});
