import { Container } from './container';
import { Injectable } from '../decorators';
import { InjectionToken } from '../token';
import { InjectableScopes } from '../types';
import { CircularDependencyError, ScopeDependencyError } from '../errors';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const TA_PARALLEL = new InjectionToken('PARALLEL');

@Injectable()
class Dep {}

@Injectable()
class Svc {
    static created = 0;

    constructor(public readonly dep: Dep) {
        Svc.created++;
    }
}

@Injectable()
class ReqScoped {}

class Db {}
class A {}
class B {}
class DelayA {}
class DelayB {}

describe('Container (concurrent resolutions)', () => {
    let container: Container;

    beforeEach(() => {
        Svc.created = 0;
        container = new Container();
        container.init();
    });

    it('should resolve the same singleton twice at the same time', async () => {
        const results = await Promise.allSettled([container.resolve(Svc), container.resolve(Svc)]);

        expect(results.map((result) => result.status)).toEqual(['fulfilled', 'fulfilled']);
        const [first, second] = results as PromiseFulfilledResult<Svc>[];
        expect(first.value).toBe(second.value);
        expect(Svc.created).toBe(1);
    });

    it('should resolve a transient class while an asynchronous singleton factory is running', async () => {
        const DB = new InjectionToken('DB');
        container.bind({
            token: DB,
            forClass: Db,
            scope: InjectableScopes.Singleton,
            useFactory: async () => {
                await delay(10);
                return new Db();
            }
        });
        container.bind({ token: ReqScoped, useClass: ReqScoped, scope: InjectableScopes.Transient });

        const results = await Promise.allSettled([container.resolve(DB), container.resolve(ReqScoped)]);

        expect(results.map((result) => result.status)).toEqual(['fulfilled', 'fulfilled']);
    });

    it('should create a singleton once whatever the number of concurrent resolutions', async () => {
        const DB = new InjectionToken('DB');
        const factory = jest.fn(async () => {
            await delay(10);
            return new Db();
        });
        container.bind({ token: DB, forClass: Db, scope: InjectableScopes.Singleton, useFactory: factory });

        const instances = await Promise.all(Array.from({ length: 10 }, () => container.resolve(DB)));

        expect(factory).toHaveBeenCalledTimes(1);
        expect(new Set(instances).size).toBe(1);
        await expect(container.resolve(DB)).resolves.toBe(instances[0]);
    });

    it('should try again after a singleton factory fails', async () => {
        const DB = new InjectionToken('DB');
        const factory = jest
            .fn<Promise<Db>, []>()
            .mockImplementationOnce(async () => {
                await delay(10);
                throw new Error('connection refused');
            })
            .mockImplementation(async () => new Db());
        container.bind({ token: DB, forClass: Db, scope: InjectableScopes.Singleton, useFactory: factory });

        const results = await Promise.allSettled([container.resolve(DB), container.resolve(DB)]);

        expect(results.map((result) => result.status)).toEqual(['rejected', 'rejected']);
        expect(factory).toHaveBeenCalledTimes(1);
        await expect(container.resolve(DB)).resolves.toBeInstanceOf(Db);
        expect(factory).toHaveBeenCalledTimes(2);
    });

    it('should create a scoped instance once per scoped container under concurrency', async () => {
        const REQUEST = new InjectionToken('REQUEST');
        const factory = jest.fn(async () => {
            await delay(10);
            return {};
        });
        container.bind({ token: REQUEST, forClass: Object, scope: InjectableScopes.Scoped, useFactory: factory });

        const scopedContainer = container.createScopedContainer();
        const [first, second] = await Promise.all([container.resolve(REQUEST, scopedContainer), container.resolve(REQUEST, scopedContainer)]);

        expect(first).toBe(second);
        expect(factory).toHaveBeenCalledTimes(1);

        await expect(container.resolve(REQUEST, container.createScopedContainer())).resolves.not.toBe(first);
        expect(factory).toHaveBeenCalledTimes(2);
    });

    it('should try again after a scoped factory fails', async () => {
        const REQUEST = new InjectionToken('REQUEST');
        const factory = jest
            .fn<Promise<object>, []>()
            .mockRejectedValueOnce(new Error('failed'))
            .mockImplementation(async () => ({}));
        container.bind({ token: REQUEST, forClass: Object, scope: InjectableScopes.Scoped, useFactory: factory });

        const scopedContainer = container.createScopedContainer();

        await expect(container.resolve(REQUEST, scopedContainer)).rejects.toThrow('failed');
        await expect(container.resolve(REQUEST, scopedContainer)).resolves.toEqual({});
    });

    describe('real errors', () => {
        const TA = new InjectionToken('A');
        const TB = new InjectionToken('B');

        it('should still detect a circular dependency', async () => {
            container.bind({ token: TA, forClass: A, scope: InjectableScopes.Singleton, inject: [TB], useFactory: () => new A() });
            container.bind({ token: TB, forClass: B, scope: InjectableScopes.Singleton, inject: [TA], useFactory: () => new B() });

            await expect(container.resolve(TA)).rejects.toThrow(new CircularDependencyError('A -> B -> A'));
        });

        it('should detect a circular dependency between two concurrent resolutions instead of waiting forever', async () => {
            const TDA = new InjectionToken('DELAY_A');
            const TDB = new InjectionToken('DELAY_B');
            container.bind({ token: TDA, forClass: DelayA, scope: InjectableScopes.Singleton, useFactory: async () => delay(5).then(() => new DelayA()) });
            container.bind({ token: TDB, forClass: DelayB, scope: InjectableScopes.Singleton, useFactory: async () => delay(20).then(() => new DelayB()) });
            container.bind({ token: TA, forClass: A, scope: InjectableScopes.Singleton, inject: [TDA, TB], useFactory: () => new A() });
            container.bind({ token: TB, forClass: B, scope: InjectableScopes.Singleton, inject: [TDB, TA], useFactory: () => new B() });

            const results = await Promise.allSettled([container.resolve(TA), container.resolve(TB)]);

            expect(results.map((result) => result.status)).toEqual(['rejected', 'rejected']);
            for (const result of results as PromiseRejectedResult[]) {
                expect(result.reason).toBeInstanceOf(CircularDependencyError);
            }
            // The dependencies are resolved in parallel, so the first resolution walks the whole graph and finds the cycle in its own chain.
            expect((results[1] as PromiseRejectedResult).reason.message).toBe('Circular dependency detected: A -> B -> A');
        });

        it('should still detect a circular dependency between scoped providers', async () => {
            container.bind({ token: TA, forClass: A, scope: InjectableScopes.Scoped, inject: [TB], useFactory: () => new A() });
            container.bind({ token: TB, forClass: B, scope: InjectableScopes.Scoped, inject: [TA], useFactory: () => new B() });

            await expect(container.resolve(TA, container.createScopedContainer())).rejects.toThrow(new CircularDependencyError('A -> B -> A'));
        });

        it('should still detect a scope violation', async () => {
            container.bind({ token: ReqScoped, useClass: ReqScoped, scope: InjectableScopes.Transient });
            container.bind({ token: TA, forClass: A, scope: InjectableScopes.Singleton, inject: [ReqScoped], useFactory: () => new A() });

            await expect(container.resolve(TA)).rejects.toThrow(new ScopeDependencyError('A (singleton) -> ReqScoped (transient)'));
        });
    });
    describe('parallel constructor dependencies', () => {
        it('should resolve the dependencies of a constructor in parallel', async () => {
            // The order of the events shows the parallelism without measuring time: resolved one by one, the first factory would end
            // before the second one starts.
            const events: string[] = [];
            const factoryOf = (name: string, forClass: any) => ({
                token: new InjectionToken(name),
                forClass,
                scope: InjectableScopes.Singleton,
                useFactory: async () => {
                    events.push(`${name}:start`);
                    await new Promise((resolve) => setImmediate(resolve));
                    events.push(`${name}:end`);
                    return name;
                }
            });
            const first = factoryOf('FIRST', A);
            const second = factoryOf('SECOND', B);
            container.bind(first);
            container.bind(second);
            container.bind({
                token: TA_PARALLEL,
                forClass: Db,
                scope: InjectableScopes.Singleton,
                inject: [first.token, second.token],
                useFactory: (a, b) => [a, b]
            });

            await expect(container.resolve(TA_PARALLEL)).resolves.toEqual(['FIRST', 'SECOND']);

            expect(events.slice(0, 2)).toEqual(['FIRST:start', 'SECOND:start']);
            expect(events).toHaveLength(4);
        });

        it('should let a dependency wait for a singleton created by another dependency of the same constructor', async () => {
            const SHARED = new InjectionToken('SHARED');
            const USES_SHARED = new InjectionToken('USES_SHARED');
            const factory = jest.fn(async () => {
                await delay(10);
                return new Db();
            });
            container.bind({ token: SHARED, forClass: Db, scope: InjectableScopes.Singleton, useFactory: factory });
            container.bind({ token: USES_SHARED, forClass: B, scope: InjectableScopes.Singleton, inject: [SHARED], useFactory: (db) => ({ db }) });
            container.bind({
                token: TA_PARALLEL,
                forClass: A,
                scope: InjectableScopes.Singleton,
                inject: [SHARED, USES_SHARED],
                useFactory: (db, uses) => ({ db, uses })
            });

            const result = (await container.resolve(TA_PARALLEL)) as { db: Db; uses: { db: Db } };

            expect(factory).toHaveBeenCalledTimes(1);
            expect(result.uses.db).toBe(result.db);
        });

        it('should keep the order of the dependencies whatever the order they are created in', async () => {
            const SLOW = new InjectionToken('SLOW');
            const FAST = new InjectionToken('FAST');
            container.bind({ token: SLOW, forClass: A, scope: InjectableScopes.Transient, useFactory: async () => delay(15).then(() => 'slow') });
            container.bind({ token: FAST, forClass: B, scope: InjectableScopes.Transient, useFactory: async () => 'fast' });
            container.bind({ token: TA_PARALLEL, forClass: Db, scope: InjectableScopes.Transient, inject: [SLOW, FAST], useFactory: (...args) => args });

            await expect(container.resolve(TA_PARALLEL)).resolves.toEqual(['slow', 'fast']);
        });
    });
});
