import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { Container } from './container';
import { ClassResolver } from './class-resolver';
import { InjectionToken } from '../token';
import { ProviderNotFoundError, DecoratorNotIncludedError, ScopedContainerNotProvidedError } from '../errors';
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
});
