/** Base class for domain-specific errors. The error name is set to the subclass name. */
export abstract class DomainException extends Error {
    /**
     * Initializes a new instance of the DomainException class.
     * @param message The error message for the exception.
     */
    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
