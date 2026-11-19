import { ClassType } from '@axisparkjs/common';

/**
 * A token used for dependency injection. Every instance is a different token, even when two instances have the same description: the description is only used in messages and logs.
 */
export class InjectionToken {
    constructor(public readonly description: string) {}

    toString() {
        return this.description;
    }
}

/**
 * A type representing a token used for dependency injection.
 */
export type Token<T = unknown> = ClassType<T> | InjectionToken;

/**
 * A static class for utility methods related to tokens.
 */
export class TokenUtilsStatic {
    /**
     * Retrieves the name of a token.
     * @param token The token for which to retrieve the name.
     * @returns The name of the token.
     */
    getName(token: Token): string {
        if (token instanceof InjectionToken) {
            return token.description;
        }
        return token.name;
    }
}
/**
 * An instance of TokenUtilsStatic that provides utility methods for working with tokens.
 */
export const TokenUtils = new TokenUtilsStatic();

/**
 * Creates a function that returns one injection token per key, so the same key always gives the same token. Use it for tokens that depend on a value known at runtime, such as the name of a connection, which are created in more than one place (where the provider is bound and where it is injected).
 * @template K - The type of the keys.
 * @param describe Builds the description of the token of a key, used in messages and logs.
 * @returns A function that returns the token of a key, creating it the first time.
 * @example
 * const connectionToken = createTokenFactory((name: string) => `CONNECTION_${name}`);
 * connectionToken('MAIN') === connectionToken('MAIN'); // true
 */
export function createTokenFactory<K>(describe: (key: K) => string): (key: K) => InjectionToken {
    const tokens = new Map<K, InjectionToken>();
    return (key: K) => {
        let token = tokens.get(key);
        if (!token) {
            token = new InjectionToken(describe(key));
            tokens.set(key, token);
        }
        return token;
    };
}
