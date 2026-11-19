import { Token } from '../token';
import { ClassResolver } from './class-resolver';
import { Container } from './container';
import { ClassProvider, FactoryProvider } from '../types';
import { ResolutionChain } from './resolution-chain';
import { PendingInstances } from './pending-instances';

/**
 * ScopedContainer is a specialized container that manages scoped instances of providers. It allows for resolving dependencies within a specific scope, ensuring that instances are isolated and have a limited lifetime. The ScopedContainer works in conjunction with the main Container and the ClassResolver to provide scoped resolution of dependencies.
 *
 * The transports create one scoped container per execution, so it is cheap: its structures are created the first time a scoped provider is resolved.
 */
export class ScopedContainer {
    // Created on the first scoped resolution, so a scoped container that never resolves a scoped provider allocates nothing else.
    private instances?: Map<Token, unknown>;
    private pendingInstances?: PendingInstances;

    /**
     * Creates a new instance of ScopedContainer.
     * @param container - The main container associated with this scoped container.
     * @param resolver - The class resolver used for resolving dependencies.
     */
    constructor(
        private readonly container: Container,
        private readonly resolver: ClassResolver
    ) {}

    /**
     * Resolves a provider within the scoped container, returning an instance of the associated class or the result of a factory function. The method manages the resolution process for scoped instances, ensuring that they are isolated and have a limited lifetime.
     * @template T - The type of the instance being resolved.
     * @param provider - The provider to resolve.
     * @param chain - The resolution chain of the classes that depend on the provider. A new chain is started when it is not given.
     * @returns A promise that resolves to an instance of the class or the result of the factory function associated with the provided token.
     */
    async resolve<T>(provider: ClassProvider<T> | FactoryProvider<T>, chain: ResolutionChain = ResolutionChain.start()): Promise<T> {
        const instances = (this.instances ??= new Map<Token, unknown>());
        if (instances.has(provider.token)) return instances.get(provider.token) as T;

        const classType = 'useClass' in provider ? provider.useClass : provider.forClass;
        if (chain.includes(classType)) return await this.resolver.resolve(provider, this.container, this, chain);

        this.pendingInstances ??= new PendingInstances();
        return await this.pendingInstances.getOrCreate(provider, classType, chain, async () => {
            const resolvedInstance = await this.resolver.resolve(provider, this.container, this, chain);
            instances.set(provider.token, resolvedInstance);
            return resolvedInstance;
        });
    }
}
