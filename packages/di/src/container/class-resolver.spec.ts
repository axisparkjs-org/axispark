import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { ClassResolver } from './class-resolver';
import { Container } from './container';
import { InjectionToken } from '../token';
import { CircularDependencyError, ScopeDependencyError } from '../errors';
import { Injectable, Inject } from '../decorators';
import { InjectableScopes } from '../types';
import { ResolutionChain } from './resolution-chain';

jest.mock('@axisparkjs/common', () => {
    const originalModule = jest.requireActual('@axisparkjs/common');
    return {
        ...originalModule,
        Metadata: {
            get: jest.fn(),
            define: jest.fn(),
            normalizeTarget: jest.fn((target) => target)
        }
    };
});

@Injectable()
class Dependency {}

@Injectable()
class ClassWithoutDependencies {}

@Injectable()
class ClassWithDependency {
    constructor(public readonly dependency: Dependency) {}
}

const token = new InjectionToken('token');

@Injectable()
class ClassWithTokenDependency {
    constructor(@Inject(token) public readonly dependency: Dependency) {}
}

const token2 = new InjectionToken('token2');

@Injectable()
class ClassWithTokenDependencies {
    constructor(
        @Inject(token) public readonly dependency: Dependency,
        @Inject(token2) public readonly dependency2: Dependency
    ) {}
}

describe('Resolver', () => {
    let resolver: ClassResolver;
    let container: { resolveInChain: jest.Mock };
    let metadataMock: { get: jest.Mock };

    beforeAll(() => {
        metadataMock = Metadata as unknown as {
            get: jest.Mock;
        };
    });

    beforeEach(() => {
        resolver = new ClassResolver();

        container = {
            resolveInChain: jest.fn()
        };

        jest.clearAllMocks();
    });

    it('should create an instance without dependencies', async () => {
        metadataMock.get.mockReturnValue(undefined);

        const instance = await resolver.resolve(
            {
                token: ClassWithoutDependencies,
                useClass: ClassWithoutDependencies,
                scope: InjectableScopes.Singleton
            },
            container as unknown as Container
        );

        expect(instance).toBeInstanceOf(ClassWithoutDependencies);
        expect(container.resolveInChain).not.toHaveBeenCalled();
    });

    it('should resolve constructor dependencies', async () => {
        const dependency = new Dependency();

        container.resolveInChain.mockResolvedValue(dependency);

        metadataMock.get.mockImplementation((key) => {
            if (key === MetadataKeys.DESIGN_PARAM_TYPES) {
                return [Dependency];
            }

            if (key === MetadataKeys.INJECT) {
                return undefined;
            }

            return undefined;
        });

        const instance = await resolver.resolve(
            {
                token: ClassWithDependency,
                useClass: ClassWithDependency,
                scope: InjectableScopes.Singleton
            },
            container as unknown as Container
        );

        expect(container.resolveInChain).toHaveBeenCalledWith(Dependency, undefined, expect.any(ResolutionChain));
        expect(instance.dependency).toBe(dependency);
    });

    it('should use injection token when present', async () => {
        const dependency = new Dependency();

        container.resolveInChain.mockResolvedValue(dependency);

        metadataMock.get.mockImplementation((key) => {
            if (key === MetadataKeys.DESIGN_PARAM_TYPES) {
                return [Dependency];
            }

            if (key === MetadataKeys.INJECT) {
                return { params: new Map([[0, token]]) };
            }

            return undefined;
        });

        const instance = await resolver.resolve(
            {
                token: ClassWithTokenDependency,
                useClass: ClassWithTokenDependency,
                scope: InjectableScopes.Singleton
            },
            container as unknown as Container
        );

        expect(container.resolveInChain).toHaveBeenCalledWith(token, undefined, expect.any(ResolutionChain));
        expect(instance.dependency).toBe(dependency);
    });

    it('should use multiple injection tokens when present', async () => {
        const dependency1 = new Dependency();
        const dependency2 = new Dependency();

        container.resolveInChain.mockImplementation(async (type) => {
            if (type === token) {
                return dependency1;
            }

            if (type === token2) {
                return dependency2;
            }

            return undefined;
        });

        metadataMock.get.mockImplementation((key) => {
            if (key === MetadataKeys.DESIGN_PARAM_TYPES) {
                return [Dependency, Dependency];
            }

            if (key === MetadataKeys.INJECT) {
                return {
                    params: new Map([
                        [0, token],
                        [1, token2]
                    ])
                };
            }

            return undefined;
        });

        const instance = await resolver.resolve(
            {
                token: ClassWithTokenDependencies,
                useClass: ClassWithTokenDependencies,
                scope: InjectableScopes.Singleton
            },
            container as unknown as Container
        );

        expect(container.resolveInChain).toHaveBeenNthCalledWith(1, token, undefined, expect.any(ResolutionChain));

        expect(container.resolveInChain).toHaveBeenNthCalledWith(2, token2, undefined, expect.any(ResolutionChain));

        expect(instance.dependency).toBe(dependency1);
        expect(instance.dependency2).toBe(dependency2);
    });

    it('should resolve a factory provider', async () => {
        container.resolveInChain.mockResolvedValue('dependency');

        const instance = await resolver.resolve(
            {
                token: token,
                inject: [token2],
                useFactory: async (value: string) => value + '-factory',
                scope: InjectableScopes.Singleton,
                forClass: String
            },
            container as unknown as Container
        );

        expect(container.resolveInChain).toHaveBeenCalledWith(token2, undefined, expect.any(ResolutionChain));

        expect(instance).toBe('dependency-factory');
    });

    it('should resolve a factory provider without dependencies', async () => {
        const instance = await resolver.resolve(
            {
                token,
                useFactory: async () => 'factory',
                scope: InjectableScopes.Singleton,
                forClass: String
            },
            container as unknown as Container
        );

        expect(container.resolveInChain).not.toHaveBeenCalled();
        expect(instance).toBe('factory');
    });

    it('should throw CircularDependencyError on circular dependency', async () => {
        metadataMock.get = jest.fn().mockReturnValueOnce([ClassWithDependency]);

        container.resolveInChain.mockImplementation((type, scopedContainer, chain) => {
            if (type === ClassWithDependency) {
                return resolver.resolve(
                    {
                        token: ClassWithDependency,
                        useClass: ClassWithDependency,
                        scope: InjectableScopes.Singleton
                    },
                    container as unknown as Container,
                    scopedContainer,
                    chain
                );
            }

            return Promise.resolve(new Dependency());
        });

        await expect(
            resolver.resolve(
                {
                    token: ClassWithDependency,
                    useClass: ClassWithDependency,
                    scope: InjectableScopes.Singleton
                },
                container as unknown as Container
            )
        ).rejects.toThrow(new CircularDependencyError('ClassWithDependency -> ClassWithDependency'));
    });

    it('should throw ScopeDependencyError when singleton depends on scoped service', async () => {
        metadataMock.get = jest.fn().mockReturnValueOnce([Dependency]);

        container.resolveInChain.mockImplementation((type, scopedContainer, chain) => {
            if (type === Dependency) {
                return resolver.resolve(
                    {
                        token: Dependency,
                        useClass: Dependency,
                        scope: InjectableScopes.Scoped
                    },
                    container as unknown as Container,
                    scopedContainer,
                    chain
                );
            }

            return Promise.resolve(undefined);
        });

        await expect(
            resolver.resolve(
                {
                    token: ClassWithDependency,
                    useClass: ClassWithDependency,
                    scope: InjectableScopes.Singleton
                },
                container as unknown as Container
            )
        ).rejects.toThrow(new ScopeDependencyError('ClassWithDependency (singleton) -> Dependency (scoped)'));
    });
});
