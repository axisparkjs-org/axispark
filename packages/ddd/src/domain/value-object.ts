/**
 * Base class for values whose equality is determined by their wrapped value.
 * Subclasses validate values and provide a string representation. Equality compares
 * the wrapped values by their JSON serialization.
 */
export abstract class ValueObject<T> {
    protected readonly _value: T;

    /**
     * Initializes a new instance of the ValueObject class.
     * @param value The value for the value object.
     */
    constructor(value: T) {
        this.validate(value);
        this._value = value;
    }

    /**
     * Gets the value for the value object.
     * @returns The value for the value object.
     */
    get value(): Readonly<T> {
        return this._value;
    }

    /**
     * Determines whether the current value object is equal to another value object of the same type.
     * @param vo The other value object to compare with.
     * @returns True if the value objects are equal; otherwise, false.
     */
    public equals(vo: ValueObject<T>): boolean {
        if (vo === null || vo === undefined) return false;
        if (this === vo) return true;
        return JSON.stringify(this._value) === JSON.stringify(vo.value);
    }

    /**
     * Validates the value for the value object.
     * @param value The value to validate.
     */
    protected abstract validate(value: T): void;

    /**
     * Converts the value object to a string representation.
     * @returns The string representation of the value object.
     */
    public abstract toString(): string;
}
