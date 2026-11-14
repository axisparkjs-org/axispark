import { InjectableScopes } from '../types';
import { ResolutionChain } from './resolution-chain';

class A {}
class B {}
class C {}

describe('ResolutionChain', () => {
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
});
