import { Injector } from './injector';
import { Container } from '../container';
import { InjectionToken } from '../token';

describe('Injector', () => {
    let container: jest.Mocked<Container>;
    let injector: Injector;

    beforeEach(() => {
        container = {
            resolve: jest.fn(),
            bind: jest.fn(),
            unbind: jest.fn(),
            createScopedContainer: jest.fn().mockReturnValue({ id: 'scope' })
        } as unknown as jest.Mocked<Container>;

        injector = new Injector(container);
    });

    describe('get', () => {
        it('should resolve the token using the container', async () => {
            const token = new InjectionToken('token');
            const instance = { foo: 'bar' };

            container.resolve.mockResolvedValue(instance);

            const result = await injector.get(token);

            expect(container.resolve).toHaveBeenCalledTimes(1);
            expect(container.resolve).toHaveBeenCalledWith(token, undefined);
            expect(result).toBe(instance);
        });

        it('should resolve the token with a scope using the container', async () => {
            const token = new InjectionToken('token');
            const scope = { id: 'scope' };
            const instance = { foo: 'bar' };

            container.resolve.mockResolvedValue(instance);

            const result = await injector.get(token, container.createScopedContainer());

            expect(container.resolve).toHaveBeenCalledTimes(1);
            expect(container.resolve).toHaveBeenCalledWith(token, scope);
            expect(result).toBe(instance);
        });
    });
    describe('tryGet', () => {
        it('should return the instance available in the container synchronously', () => {
            const token = new InjectionToken('token');
            container.tryResolve = jest.fn().mockReturnValue('instance');

            expect(injector.tryGet(token)).toBe('instance');
            expect(container.tryResolve).toHaveBeenCalledWith(token);
        });
    });

    describe('isSingleton', () => {
        it('should check the token with the container', () => {
            const token = new InjectionToken('token');
            container.isSingleton = jest.fn().mockReturnValue(true);

            expect(injector.isSingleton(token)).toBe(true);
            expect(container.isSingleton).toHaveBeenCalledWith(token);
        });
    });
});
