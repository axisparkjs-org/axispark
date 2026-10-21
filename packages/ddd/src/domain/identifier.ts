import { ValueObject } from './value-object';

/**
 * Value-object base for strongly typed entity identifiers.
 * Subclasses implement `validate`; `toString()` converts the wrapped value with `String`.
 */
export abstract class Identifier<T = string> extends ValueObject<T> {
    /**
     * Converts the identifier to a string representation.
     * @returns The string representation of the identifier.
     */
    toString(): string {
        return String(this._value);
    }
}
