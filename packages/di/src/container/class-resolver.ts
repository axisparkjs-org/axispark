import { Metadata, MetadataKeys, Resolver, ClassType } from '@axisparkjs/common';
import { ResolutionChain } from './resolution-chain';
import { Container } from './container';
import { Token } from '../token';
import { ClassProvider, FactoryProvider, InjectableScopes } from '../types';
import { ScopeDependencyError, CircularDependencyError } from '../errors';
import { ScopedContainer } from './scoped-container';
import { InjectMetadata } from '../metadata';

/**
 * ClassResolver is responsible for resolving class providers and factory providers. It handles the instantiation of classes, resolving their dependencies in parallel, and managing scopes. It also detects circular dependencies and scope violations during the resolution process. The only state of the resolver is the cache of the constructor tokens of each class: the classes that are being resolved are kept in the resolution chain of each resolution, so concurrent resolutions never see the dependencies of each other.
 * @template T - The type of the instance being resolved.
 */
export class ClassResolver<T = unknown> implements Resolver<T> {
    private readonly constructorTokens = new WeakMap<ClassType, Token[]>();

    /**
     * Resolves a class provider or factory provider, instantiating the class and resolving its dependencies. It manages the resolution process, including handling scopes and detecting circular dependencies.
     * @param provider - The class provider or factory provider to resolve.
     * @param container - The container used for resolving dependencies.
     * @param scopedContainer - An optional scoped container for managing scoped instances.
     * @param chain - The resolution chain of the classes that depend on the provider. A new chain is started when it is not given.
     * @returns A promise that resolves to an instance of the class or the result of the factory function.
     * @throws {CircularDependencyError} If a circular dependency is detected during resolution.
     * @throws {ScopeDependencyError} If a scope violation is detected during resolution.
     */
    async resolve<T>(
        provider: ClassProvider<T> | FactoryProvider<T>,
        container: Container,
        scopedContainer?: ScopedContainer,
        chain: ResolutionChain = ResolutionChain.start()
    ): Promise<T> {
        const { scope } = provider;
        let classType: ClassType<T>;
        if ('useClass' in provider) {
            classType = provider.useClass;
        } else {
            classType = provider.forClass;
        }

        if (chain.includes(classType)) {
            throw new CircularDependencyError(chain.describe(false, classType));
        }
        const next = chain.with({ classType, scope });
        if ((scope === InjectableScopes.Scoped || scope === InjectableScopes.Transient) && chain.hasSingleton()) {
            throw new ScopeDependencyError(next.describe(true));
        }

        let instance: T;
        if ('useClass' in provider) {
            instance = new classType(...(await ClassResolver.resolveAll(this.tokensOf(classType), container, scopedContainer, next)));
        } else {
            instance = await provider.useFactory(...(await ClassResolver.resolveAll(provider.inject ?? [], container, scopedContainer, next)));
        }

        return instance;
    }

    /**
     * Returns the tokens of the constructor dependencies of a class: the `@Inject()` token of each parameter, or its `design:paramtypes`
     * type. They are read from the metadata the first time and kept by class (in this resolver, so each container has its own
     * cache), so instantiating a known class does not read metadata.
     * @param classType - The class whose dependencies are returned.
     * @returns The tokens, in the order of the constructor parameters.
     */
    tokensOf(classType: ClassType): Token[] {
        let tokens = this.constructorTokens.get(classType);
        if (!tokens) {
            const paramTypes: Token[] = Metadata.get(MetadataKeys.DESIGN_PARAM_TYPES, classType) ?? [];
            const metadata = Metadata.get<InjectMetadata>(MetadataKeys.INJECT, classType);
            tokens = paramTypes.map((paramType, index) => metadata?.params.get(index) ?? paramType);
            this.constructorTokens.set(classType, tokens);
        }
        return tokens;
    }

    /*
     * Resolves the dependencies in parallel. Each dependency gets a fork of the chain when there are several, so they can wait for the
     * instances created by each other without being taken for a cycle.
     */
    private static async resolveAll(
        tokens: Token[],
        container: Container,
        scopedContainer: ScopedContainer | undefined,
        chain: ResolutionChain
    ): Promise<unknown[]> {
        if (tokens.length === 0) return [];
        if (tokens.length === 1) return [await container.resolveInChain(tokens[0], scopedContainer, chain)];
        return await Promise.all(tokens.map((token) => container.resolveInChain(token, scopedContainer, chain.fork())));
    }
}
