import { ScopedContainer } from './scoped-container';
import { ClassResolver } from './class-resolver';
import { Container } from './container';
import { InjectionToken } from '../token';
import { InjectableScopes } from '../types';
import { ResolutionChain } from './resolution-chain';

describe('ScopedContainer', () => {
    let container: Container;
    let resolver: ClassResolver;
    let scopedContainer: ScopedContainer;

    beforeEach(() => {
        container = {} as Container;
        resolver = {
            resolve: jest.fn()
        } as unknown as ClassResolver;

        scopedContainer = new ScopedContainer(container, resolver);

        jest.clearAllMocks();
    });

    it('should resolve a scoped instance', async () => {
        const token = new InjectionToken('service');
        const instance = { id: 1 };

        (resolver.resolve as jest.Mock).mockResolvedValue(instance);

        const provider = {
            token,
            useClass: class Service {},
            scope: InjectableScopes.Scoped
        };

        await expect(scopedContainer.resolve(provider)).resolves.toBe(instance);

        expect(resolver.resolve).toHaveBeenCalledWith(provider, container, scopedContainer, expect.any(ResolutionChain));
    });

    it('should cache resolved scoped instances', async () => {
        const token = new InjectionToken('service');
        const instance = { id: 1 };

        (resolver.resolve as jest.Mock).mockResolvedValue(instance);

        const provider = {
            token,
            useClass: class Service {},
            scope: InjectableScopes.Scoped
        };

        const resolved1 = await scopedContainer.resolve(provider);
        const resolved2 = await scopedContainer.resolve(provider);

        expect(resolved1).toBe(instance);
        expect(resolved2).toBe(instance);
        expect(resolver.resolve).toHaveBeenCalledTimes(1);
    });

    it('should cache factory providers by token', async () => {
        const token = new InjectionToken('factory');
        const instance = { value: 123 };

        (resolver.resolve as jest.Mock).mockResolvedValue(instance);

        const provider = {
            token,
            useFactory: jest.fn(),
            scope: InjectableScopes.Scoped,
            forClass: Object
        };

        const resolved1 = await scopedContainer.resolve(provider);
        const resolved2 = await scopedContainer.resolve(provider);

        expect(resolved1).toBe(instance);
        expect(resolved2).toBe(instance);
        expect(resolver.resolve).toHaveBeenCalledTimes(1);
    });

    it('should cache different providers independently', async () => {
        const token1 = new InjectionToken('service1');
        const token2 = new InjectionToken('service2');

        const instance1 = { id: 1 };
        const instance2 = { id: 2 };

        (resolver.resolve as jest.Mock).mockResolvedValueOnce(instance1).mockResolvedValueOnce(instance2);

        const provider1 = {
            token: token1,
            useClass: class Service1 {},
            scope: InjectableScopes.Scoped
        };

        const provider2 = {
            token: token2,
            useClass: class Service2 {},
            scope: InjectableScopes.Scoped
        };

        expect(await scopedContainer.resolve(provider1)).toBe(instance1);
        expect(await scopedContainer.resolve(provider2)).toBe(instance2);

        expect(resolver.resolve).toHaveBeenCalledTimes(2);
    });

    it('should reuse cached instance even if resolver returns another object', async () => {
        const token = new InjectionToken('service');

        const instance1 = { id: 1 };
        const instance2 = { id: 2 };

        (resolver.resolve as jest.Mock).mockResolvedValueOnce(instance1).mockResolvedValueOnce(instance2);

        const provider = {
            token,
            useClass: class Service {},
            scope: InjectableScopes.Scoped
        };

        expect(await scopedContainer.resolve(provider)).toBe(instance1);
        expect(await scopedContainer.resolve(provider)).toBe(instance1);

        expect(resolver.resolve).toHaveBeenCalledTimes(1);
    });
});
