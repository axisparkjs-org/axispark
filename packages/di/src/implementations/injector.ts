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
    public get<T>(token: Token<T>, scopedContainer?: ScopedContainer): Promise<T> {
        return this.container.resolve<T>(token, scopedContainer);
    }

    /**
     * Returns the instance of a token synchronously when it is already available (a value, or a singleton that is already created), without
     * creating it. Use it in hot paths and fall back to `get()` when it returns `undefined`.
     * @param token The token of the instance.
     * @returns The instance, or `undefined` when it is not available without a resolution.
     */
    public tryGet<T>(token: Token<T>): T | undefined {
        return this.container.tryResolve<T>(token);
    }
}
