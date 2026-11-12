import { Initializable, Metadata, MetadataKeys, ClassType } from '@axisparkjs/common';
import { ClassResolver } from './class-resolver';
import { ProviderNotFoundError, DecoratorNotIncludedError, ScopedContainerNotProvidedError, CircularDependencyError } from '../errors';
import { ClassProvider, Provider, InjectableScopes, FactoryProvider, ExistingProvider } from '../types';
import { Token, TokenUtils } from '../token';
import { ScopedContainer } from './scoped-container';
import { Injectable } from '../decorators';
import { ClassRegistry } from '../registry';
import { InjectableScopeMetadata, InjectableTokenMetadata } from '../metadata';

/**
 * Container is a dependency injection container that manages the registration and resolution of providers. It allows for binding providers, resolving instances, and managing scopes. The container supports singleton, scoped, and transient lifetimes for providers, enabling flexible dependency management in applications.
 */
export class Container implements Initializable {
    private readonly providers = new Map<Token, Provider>();
    private readonly resolver = new ClassResolver();

    /**
     * Initializes the container by scanning for classes decorated with `@Injectable` and binding them to the container. It retrieves metadata for injectable classes and registers them with their respective tokens and scopes. This method should be called after all providers have been registered to ensure that the container is properly initialized.
     */
    init() {
        ClassRegistry.getWithMetadata(MetadataKeys.INJECTABLE).forEach((entry) => {
            const injectableTokenMetadata = Metadata.get<InjectableTokenMetadata>(MetadataKeys.INJECTABLE_TOKEN, entry);
            const injectableScopeMetadata = Metadata.get<InjectableScopeMetadata>(MetadataKeys.INJECTABLE_SCOPE, entry) ?? {
                target: entry,
                scope: InjectableScopes.Singleton
            };
            if (injectableTokenMetadata) this.bind({ token: injectableTokenMetadata.injectionToken, useClass: entry, scope: injectableScopeMetadata.scope });

            if (!this.providers.has(entry)) this.bind({ token: entry, useClass: entry, scope: injectableScopeMetadata.scope });
        });
    }

    /**
     * Binds a provider or class type to the container. If a class type is provided, it is automatically wrapped in a ClassProvider with a singleton scope. The method checks for the presence of the `@Injectable` decorator on the class and throws an error if it is not included. This ensures that only properly decorated classes can be registered with the container.
     * @template T - The type of the instance being bound.
     * @param provider - The provider or class type to bind to the container.
     * @throws {DecoratorNotIncludedError} If the `@Injectable` decorator is not included on the class being bound.
     */
    bind<T>(provider: Provider<T> | ClassType<T>): void {
        if (!('token' in provider)) {
            provider = { token: provider, useClass: provider, scope: InjectableScopes.Singleton } as ClassProvider<T>;
        }

        if ('useClass' in provider && !Metadata.has(MetadataKeys.INJECTABLE, provider.useClass))
            throw new DecoratorNotIncludedError(TokenUtils.getName(provider.useClass), Injectable.name);

        this.providers.set(provider.token, provider);
    }

    /**
     * Unbinds a provider from the container based on the provided token. This method removes the binding associated with the specified token, allowing for dynamic management of providers within the container. If the token is not found, no action is taken.
     * @template T - The type of the instance being unbound.
     * @param token - The token for the provider to unbind.
     */
    unbind<T>(token: Token<T>): void {
        this.providers.delete(token);
    }

    /**
     * Creates a new scoped container that is associated with the current container. The scoped container allows for managing scoped instances of providers, enabling the resolution of dependencies within a specific scope. This is useful for scenarios where certain instances need to be isolated or have a limited lifetime.
     * @returns A new instance of ScopedContainer that is associated with the current container and uses the specified resolver for dependency resolution.
     */
    createScopedContainer(): ScopedContainer {
        return new ScopedContainer(this, this.resolver);
    }

    /**
     * Resolves a provider based on the provided token, returning an instance of the associated class or the result of a factory function. The method handles different scopes (singleton, scoped, transient) and manages the resolution process accordingly. If a scoped container is provided, it is used for resolving scoped instances. If the provider is not found, an error is thrown.
     * @template T - The type of the instance being resolved.
     * @param token - The token for the provider to resolve.
     * @param scopedContainer - An optional scoped container for managing scoped instances during resolution. If not provided, the default resolution process is used.
     * @returns A promise that resolves to an instance of the class or the result of the factory function associated with the provided token.
     * @throws {ProviderNotFoundError} If the provider associated with the provided token is not found in the container.
     * @throws {ScopedContainerNotProvidedError} If a scoped provider is being resolved but no scoped container is provided.
     * @throws {CircularDependencyError} If a chain of `useExisting` providers points back to one of its own tokens.
     */
    async resolve<T>(token: Token<T>, scopedContainer?: ScopedContainer): Promise<T> {
        const provider = this.providers.get(token) as Provider<T> | undefined;
        if (!provider) throw new ProviderNotFoundError(token);

        if ('useValue' in provider) return provider.useValue;
        if ('useExisting' in provider) return await this.resolveExisting(provider, scopedContainer);

        let instance: T;
        switch (provider.scope) {
            case InjectableScopes.Singleton:
                instance = await this.resolveSingleton(provider);
                break;
            case InjectableScopes.Scoped:
                if (!scopedContainer) throw new ScopedContainerNotProvidedError(token);
                instance = await scopedContainer.resolve(provider);
                break;
            case InjectableScopes.Transient:
                instance = await this.resolveTransient(provider);
                break;
        }

        return instance;
    }

    private async resolveExisting<T>(provider: ExistingProvider<T>, scopedContainer?: ScopedContainer): Promise<T> {
        const aliases: Token[] = [provider.token];
        let target: Token<T> = provider.useExisting;
        let targetProvider = this.providers.get(target) as Provider<T> | undefined;
        while (targetProvider && 'useExisting' in targetProvider) {
            if (aliases.includes(target)) {
                throw new CircularDependencyError([...aliases, target].map((t) => TokenUtils.getName(t)).join(' -> '));
            }
            aliases.push(target);
            target = targetProvider.useExisting;
            targetProvider = this.providers.get(target) as Provider<T> | undefined;
        }

        return await this.resolve(target, scopedContainer);
    }

    private async resolveSingleton<T>(provider: ClassProvider<T> | FactoryProvider<T>, scopedContainer?: ScopedContainer): Promise<T> {
        const instance = await this.resolveInstance(provider, scopedContainer);
        this.bind({ token: provider.token, useValue: instance });
        return instance;
    }

    private async resolveTransient<T>(provider: ClassProvider<T> | FactoryProvider<T>, scopedContainer?: ScopedContainer): Promise<T> {
        return await this.resolveInstance(provider, scopedContainer);
    }

    private async resolveInstance<T>(provider: ClassProvider<T> | FactoryProvider<T>, scopedContainer?: ScopedContainer): Promise<T> {
        const instance = await this.resolver.resolve(provider, this, scopedContainer);
        return instance;
    }
}
