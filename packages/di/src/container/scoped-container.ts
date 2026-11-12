import { Token } from '../token';
import { ClassResolver } from './class-resolver';
import { Container } from './container';
import { ClassProvider, FactoryProvider } from '../types';

/**
 * ScopedContainer is a specialized container that manages scoped instances of providers. It allows for resolving dependencies within a specific scope, ensuring that instances are isolated and have a limited lifetime. The ScopedContainer works in conjunction with the main Container and the ClassResolver to provide scoped resolution of dependencies.
 */
export class ScopedContainer {
    private readonly instances = new Map<Token, unknown>();

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
     * @returns A promise that resolves to an instance of the class or the result of the factory function associated with the provided token.
     */
    async resolve<T>(provider: ClassProvider<T> | FactoryProvider<T>): Promise<T> {
        if (this.instances.has(provider.token)) return this.instances.get(provider.token) as T;

        const resolvedInstance = (await this.resolver.resolve(provider, this.container, this)) as T;

        this.instances.set(provider.token, resolvedInstance);
        return resolvedInstance;
    }
}
