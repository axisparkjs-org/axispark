import { Container, ScopedContainer } from '../container';
import { Token } from '../token';
import { Injectable } from '../decorators';

/**
 * A class that provides dependency injection functionality.
 */
@Injectable()
export class Injector {
    constructor(private readonly container: Container) {}

    /**
     * Resolves a dependency for the given token.
     * @param token The token for which to resolve the dependency.
     * @param scopedContainer The scoped container to use for resolution.
     * @returns A promise resolving to the resolved dependency.
     */
    public async get<T>(token: Token<T>, scopedContainer?: ScopedContainer): Promise<T> {
        return await this.container.resolve<T>(token, scopedContainer);
    }

    /**
     * Checks whether a token always resolves to the same instance, so the instance can be kept and reused.
     * @param token The token to check.
     * @returns `true` when the token is bound to a singleton or a value.
     */
    public isSingleton(token: Token): boolean {
        return this.container.isSingleton(token);
    }
}
