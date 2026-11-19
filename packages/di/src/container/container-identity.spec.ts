import { Container } from './container';
import { Injectable } from '../decorators';
import { InjectionToken } from '../token';
import { InjectableScopes } from '../types';

const createUserService = (kind: string) => {
    @Injectable()
    class UserService {
        kind = kind;
    }
    return UserService;
};

describe('Container (tokens by identity)', () => {
    const UserServiceA = createUserService('A');
    const UserServiceB = createUserService('B');

    let container: Container;

    beforeEach(() => {
        container = new Container();
        container.init();
    });

    it('should resolve two classes with the same name to their own instances', async () => {
        const a = await container.resolve(UserServiceA);
        const b = await container.resolve(UserServiceB);

        expect(UserServiceA.name).toBe(UserServiceB.name);
        expect(a).toBeInstanceOf(UserServiceA);
        expect(a.kind).toBe('A');
        expect(b).toBeInstanceOf(UserServiceB);
        expect(b.kind).toBe('B');
    });

    it('should keep two injection tokens with the same description as different tokens', async () => {
        const first = new InjectionToken('CONFIG');
        const second = new InjectionToken('CONFIG');

        container.bind({ token: first, useValue: 'one' });
        container.bind({ token: second, useValue: 'two' });

        await expect(container.resolve(first)).resolves.toBe('one');
        await expect(container.resolve(second)).resolves.toBe('two');
    });

    it('should not replace the provider of a class with a token that has the name of the class', async () => {
        const token = new InjectionToken(UserServiceA.name);

        container.bind({ token, useValue: 'value' });

        await expect(container.resolve(UserServiceA)).resolves.toBeInstanceOf(UserServiceA);
        await expect(container.resolve(token)).resolves.toBe('value');
    });

    it('should only unbind the given token', async () => {
        const first = new InjectionToken('CONFIG');
        const second = new InjectionToken('CONFIG');

        container.bind({ token: first, useValue: 'one' });
        container.bind({ token: second, useValue: 'two' });
        container.unbind(first);

        await expect(container.resolve(first)).rejects.toThrow("No provider found for 'CONFIG'.");
        await expect(container.resolve(second)).resolves.toBe('two');
    });

    it('should keep the scoped instances of two classes with the same name apart', async () => {
        container.bind({ token: UserServiceA, useClass: UserServiceA, scope: InjectableScopes.Scoped });
        container.bind({ token: UserServiceB, useClass: UserServiceB, scope: InjectableScopes.Scoped });

        const scopedContainer = container.createScopedContainer();

        const a = await container.resolve(UserServiceA, scopedContainer);
        const b = await container.resolve(UserServiceB, scopedContainer);

        expect(a.kind).toBe('A');
        expect(b.kind).toBe('B');
        await expect(container.resolve(UserServiceA, scopedContainer)).resolves.toBe(a);
        await expect(container.resolve(UserServiceB, scopedContainer)).resolves.toBe(b);
    });

    it('should keep the scoped instances of two tokens with the same description apart', async () => {
        const first = new InjectionToken('REQUEST_ID');
        const second = new InjectionToken('REQUEST_ID');

        container.bind({ token: first, useFactory: () => 'first', forClass: String, scope: InjectableScopes.Scoped });
        container.bind({ token: second, useFactory: () => 'second', forClass: String, scope: InjectableScopes.Scoped });

        const scopedContainer = container.createScopedContainer();

        await expect(container.resolve(first, scopedContainer)).resolves.toBe('first');
        await expect(container.resolve(second, scopedContainer)).resolves.toBe('second');
    });
});
