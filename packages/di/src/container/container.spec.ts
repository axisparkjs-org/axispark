import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { Container } from './container';
import { ClassResolver } from './class-resolver';
import { InjectionToken } from '../token';
import { ProviderNotFoundError, DecoratorNotIncludedError, ScopedContainerNotProvidedError, CircularDependencyError } from '../errors';
import { Constructable } from '../decorators/constructable';
import { ClassRegistry } from '../registry/class-registry';
import { InjectableScopes } from '../types';
import { ResolutionChain } from './resolution-chain';

jest.mock('@axisparkjs/common', () => {
    const originalModule = jest.requireActual('@axisparkjs/common');

    return {
        ...originalModule,
        Metadata: {
            get: jest.fn(),
            has: jest.fn(),
            define: jest.fn()
        }
    };
});

jest.mock('../registry/class-registry', () => {
    const originalModule = jest.requireActual('../registry/class-registry');

    return {
        ...originalModule,
        ClassRegistry: {
            register: jest.fn(),
            getWithMetadata: jest.fn().mockReturnValue([])
        }
    };
});

describe('Container', () => {
    let container: Container;
    let metadataMock: {
        has: jest.Mock;
        get: jest.Mock;
        define: jest.Mock;
    };

    beforeAll(() => {
        metadataMock = Metadata as unknown as {
            has: jest.Mock;
            get: jest.Mock;
            define: jest.Mock;
        };
    });

    beforeEach(() => {
        container = new Container();
        jest.clearAllMocks();
    });

    @Constructable()
    class Service {}

    class Dependency {}

    it('should init all ClassRegistry entries with INJECTABLE metadata', () => {
        const injectableClass = class InjectableClass {};
        const alreadyInjectableClass = class AlreadyInjectableClass {};

        ClassRegistry.getWithMetadata = jest.fn().mockReturnValue([injectableClass, alreadyInjectableClass]);

        metadataMock.get.mockImplementation((key) => {
            if (key === MetadataKeys.INJECTABLE_SCOPE) {
                return { scope: InjectableScopes.Singleton };
            }

            return undefined;
        });

        metadataMock.has.mockReturnValue(true);

        const spyBind = jest.spyOn(container, 'bind');

        container.bind(alreadyInjectableClass);
        container.init();

        expect(spyBind).toHaveBeenCalledWith({ token: injectableClass, useClass: injectableClass, scope: InjectableScopes.Singleton });
    });

    it('should init all ClassRegistry entries with INJECTABLE metadata and add TOKEN metadata', () => {
        const token = new InjectionToken('token');
        const injectableClass = class InjectableClass {};

        ClassRegistry.getWithMetadata = jest.fn().mockReturnValue([injectableClass]);

        metadataMock.get.mockImplementation((key) => {
            if (key === MetadataKeys.INJECTABLE_SCOPE) {
                return undefined;
            }

            if (key === MetadataKeys.INJECTABLE_TOKEN) {
                return { injectionToken: token };
            }

            return undefined;
        });

        const spyBind = jest.spyOn(container, 'bind');

        container.init();

        expect(spyBind).toHaveBeenCalledWith({
            token,
            useClass: injectableClass,
            scope: InjectableScopes.Singleton
        });
    });

    it('should bind a constructor as a class provider', () => {
        metadataMock.has.mockReturnValue(true);

        expect(() => container.bind(Service)).not.toThrow();
    });

    it('should throw when binding a non constructable class', () => {
        metadataMock.has.mockReturnValue(false);

        expect(() => container.bind(Service)).toThrow(DecoratorNotIncludedError);
    });

    it('should bind a token', () => {
        const token = new InjectionToken('token');

        expect(() =>
            container.bind({
                token,
                useValue: 'value'
            })
        ).not.toThrow();
    });

    it('should throw when binding a non constructable class with a token', () => {
        const token = new InjectionToken('token');

        metadataMock.has.mockReturnValue(false);

        expect(() =>
            container.bind({
                token,
                useClass: Service,
                scope: InjectableScopes.Singleton
            })
        ).toThrow(DecoratorNotIncludedError);
    });

    it('should unbind a provider', () => {
        const token = new InjectionToken('token');

        container.bind({
            token,
            useValue: 'value'
        });

        expect(() => container.unbind(token)).not.toThrow();
    });

    it('should throw when resolving an unbound class', async () => {
        const token = new InjectionToken('token');

        await expect(container.resolve(token)).rejects.toThrow(ProviderNotFoundError);
    });

    it('should resolve a value provider', async () => {
        const token = new InjectionToken('value');

        container.bind({
            token,
            useValue: 123
        });

        await expect(container.resolve(token)).resolves.toBe(123);
    });

    it('should resolve an existing provider', async () => {
        const token1 = new InjectionToken('token1');
        const token2 = new InjectionToken('token2');

        container.bind({
            token: token1,
            useValue: 10
        });

        container.bind({
            token: token2,
            useExisting: token1
        });

        await expect(container.resolve(token2)).resolves.toBe(10);
    });

    describe('existing providers', () => {
        const alias = new InjectionToken('SERVICE_ALIAS');

        beforeEach(() => {
            metadataMock.has.mockReturnValue(true);
            jest.spyOn(ClassResolver.prototype, 'resolve').mockImplementation(async () => new Service());
        });

        it.each([InjectableScopes.Singleton, InjectableScopes.Transient])('should resolve an alias of a %s class', async (scope) => {
            container.bind({ token: Service, useClass: Service, scope });
            container.bind({ token: alias, useExisting: Service });

            await expect(container.resolve(alias)).resolves.toBeInstanceOf(Service);
        });

        it('should resolve an alias of a singleton class to the same instance as the class', async () => {
            container.bind({ token: Service, useClass: Service, scope: InjectableScopes.Singleton });
            container.bind({ token: alias, useExisting: Service });

            const fromAlias = await container.resolve(alias);

            await expect(container.resolve(Service)).resolves.toBe(fromAlias);
        });

        it('should pass the scoped container to the target of an alias', async () => {
            container.bind({ token: Service, useClass: Service, scope: InjectableScopes.Scoped });
            container.bind({ token: alias, useExisting: Service });

            const scopedContainer = container.createScopedContainer();
            const fromAlias = await container.resolve(alias, scopedContainer);

            expect(fromAlias).toBeInstanceOf(Service);
            await expect(container.resolve(Service, scopedContainer)).resolves.toBe(fromAlias);
            await expect(container.resolve(alias, container.createScopedContainer())).resolves.not.toBe(fromAlias);
        });

        it('should throw ScopedContainerNotProvidedError for an alias of a scoped class without a scoped container', async () => {
            container.bind({ token: Service, useClass: Service, scope: InjectableScopes.Scoped });
            container.bind({ token: alias, useExisting: Service });

            await expect(container.resolve(alias)).rejects.toThrow(ScopedContainerNotProvidedError);
        });

        it('should resolve a chain of aliases', async () => {
            const second = new InjectionToken('SECOND_ALIAS');
            container.bind({ token: Service, useClass: Service, scope: InjectableScopes.Scoped });
            container.bind({ token: alias, useExisting: Service });
            container.bind({ token: second, useExisting: alias });

            const scopedContainer = container.createScopedContainer();

            const fromAlias = await container.resolve(second, scopedContainer);

            await expect(container.resolve(Service, scopedContainer)).resolves.toBe(fromAlias);
        });

        it('should throw CircularDependencyError for an alias that points to itself', async () => {
            container.bind({ token: alias, useExisting: alias });

            await expect(container.resolve(alias)).rejects.toThrow(new CircularDependencyError('SERVICE_ALIAS -> SERVICE_ALIAS'));
        });

        it('should throw CircularDependencyError for two aliases that point to each other', async () => {
            const other = new InjectionToken('OTHER_ALIAS');
            container.bind({ token: alias, useExisting: other });
            container.bind({ token: other, useExisting: alias });

            await expect(container.resolve(alias)).rejects.toThrow(new CircularDependencyError('SERVICE_ALIAS -> OTHER_ALIAS -> SERVICE_ALIAS'));
        });

        it('should throw ProviderNotFoundError when the target of an alias is not bound', async () => {
            container.bind({ token: alias, useExisting: new InjectionToken('MISSING') });

            await expect(container.resolve(alias)).rejects.toThrow(ProviderNotFoundError);
        });
    });

    it('should resolve a factory provider', async () => {
        const depToken = new InjectionToken('dep');
        const factoryToken = new InjectionToken('factory');

        const dependency = new Dependency();

        container.bind({
            token: depToken,
            useValue: dependency
        });

        container.bind({
            token: factoryToken,
            useFactory: (dep: Dependency) => dep.constructor.name,
            inject: [depToken],
            scope: InjectableScopes.Singleton,
            forClass: String
        });

        jest.spyOn(ClassResolver.prototype, 'resolve').mockResolvedValue('Dependency');

        await expect(container.resolve(factoryToken)).resolves.toBe('Dependency');
    });

    it('should resolve a factory provider without dependencies', async () => {
        const factoryToken = new InjectionToken('factory');

        container.bind({
            token: factoryToken,
            useFactory: () => 'no dependencies',
            forClass: String,
            scope: InjectableScopes.Singleton
        });

        jest.spyOn(ClassResolver.prototype, 'resolve').mockResolvedValue('no dependencies');

        await expect(container.resolve(factoryToken)).resolves.toBe('no dependencies');
    });

    it('should resolve a class provider', async () => {
        metadataMock.has.mockReturnValue(true);

        const instance = new Service();

        const spy = jest.spyOn(ClassResolver.prototype, 'resolve').mockResolvedValue(instance);

        container.bind(Service);

        await expect(container.resolve(Service)).resolves.toBe(instance);

        expect(spy).toHaveBeenCalledWith(
            {
                token: Service,
                useClass: Service,
                scope: InjectableScopes.Singleton
            },
            container,
            undefined,
            expect.any(ResolutionChain)
        );
    });

    it('should cache resolved singleton instances', async () => {
        metadataMock.has.mockReturnValue(true);

        const instance = new Service();

        const spy = jest.spyOn(ClassResolver.prototype, 'resolve').mockResolvedValue(instance);

        container.bind(Service);

        await expect(container.resolve(Service)).resolves.toBe(instance);
        await expect(container.resolve(Service)).resolves.toBe(instance);

        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should not cache transient instances', async () => {
        metadataMock.has.mockReturnValue(true);

        const instance = new Service();

        const spy = jest.spyOn(ClassResolver.prototype, 'resolve').mockResolvedValue(instance);

        container.bind({
            token: Service,
            useClass: Service,
            scope: InjectableScopes.Transient
        });

        await container.resolve(Service);
        await container.resolve(Service);

        expect(spy).toHaveBeenCalledTimes(2);
    });

    it('should resolve scoped instances with a scoped container', async () => {
        metadataMock.has.mockReturnValue(true);

        const instance = new Service();

        const spy = jest.spyOn(ClassResolver.prototype, 'resolve').mockResolvedValue(instance);

        container.bind({
            token: Service,
            useClass: Service,
            scope: InjectableScopes.Scoped
        });

        const scopedContainer = container.createScopedContainer();

        await expect(container.resolve(Service, scopedContainer)).resolves.toBe(instance);

        expect(spy).toHaveBeenCalledWith(
            {
                token: Service,
                useClass: Service,
                scope: InjectableScopes.Scoped
            },
            container,
            scopedContainer,
            expect.any(ResolutionChain)
        );
    });

    it('should throw when resolving scoped provider without scoped container', async () => {
        metadataMock.has.mockReturnValue(true);

        container.bind({
            token: Service,
            useClass: Service,
            scope: InjectableScopes.Scoped
        });

        await expect(container.resolve(Service)).rejects.toThrow(ScopedContainerNotProvidedError);
    });

    it('should throw ProviderNotFoundError when provider does not exist', async () => {
        metadataMock.has.mockReturnValue(false);

        container = new Container();

        await expect(container.resolve(Service)).rejects.toThrow(ProviderNotFoundError);
    });

    it('should create a scoped container', () => {
        expect(container.createScopedContainer()).toBeDefined();
    });
    describe('isSingleton', () => {
        class SingletonService {}
        class ScopedService {}
        class TransientService {}

        const token = (name: string) => new InjectionToken(name);
        const [value, alias, factory, missing, a, b, dangling] = ['value', 'alias', 'factory', 'missing', 'a', 'b', 'dangling'].map(token);

        beforeEach(() => {
            metadataMock.has.mockReturnValue(true);
        });

        it('returns true for singletons and values, also through aliases', () => {
            const container = new Container();
            container.bind({ token: SingletonService, useClass: SingletonService, scope: InjectableScopes.Singleton });
            container.bind({ token: value, useValue: 1 as any });
            container.bind({ token: alias, useExisting: value });
            container.bind({ token: factory, useFactory: () => 1, forClass: SingletonService as any, scope: InjectableScopes.Singleton });

            expect(container.isSingleton(SingletonService)).toBe(true);
            expect(container.isSingleton(value)).toBe(true);
            expect(container.isSingleton(alias)).toBe(true);
            expect(container.isSingleton(factory)).toBe(true);
        });

        it('returns false for scoped, transient, missing and circular tokens', () => {
            const container = new Container();
            container.bind({ token: ScopedService, useClass: ScopedService, scope: InjectableScopes.Scoped });
            container.bind({ token: TransientService, useClass: TransientService, scope: InjectableScopes.Transient });
            container.bind({ token: a, useExisting: b });
            container.bind({ token: b, useExisting: a });
            container.bind({ token: dangling, useExisting: missing });

            expect(container.isSingleton(ScopedService)).toBe(false);
            expect(container.isSingleton(TransientService)).toBe(false);
            expect(container.isSingleton(missing)).toBe(false);
            expect(container.isSingleton(a)).toBe(false);
            expect(container.isSingleton(dangling)).toBe(false);
        });
    });
});
