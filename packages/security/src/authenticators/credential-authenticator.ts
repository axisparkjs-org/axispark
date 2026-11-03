import { ExecutionContext } from '@axisparkjs/engine';
import { Authenticator } from '../types/authenticator';

/**
 * Base class for authenticators that read a credential from the execution and turn it into a principal.
 *
 * Authentication is split in two steps: {@link extract} reads the credential (for example, a header) and
 * {@link validate} checks it and returns the principal. `authenticate` calls both, so subclasses work with the
 * `all` and `selected` strategies, the DI container and the guards like any other {@link Authenticator}.
 * @template TCredential Credential read from the execution, such as a token or a username and password.
 * @template TPrincipal Application-defined principal returned for a valid credential.
 */
export abstract class CredentialAuthenticator<TCredential, TPrincipal = unknown> extends Authenticator {
    /**
     * Calls {@link extract} and, when a credential is found, {@link validate}.
     * @returns The principal, or `undefined` when there is no credential or it is not valid.
     */
    async authenticate(executionContext: ExecutionContext): Promise<TPrincipal | undefined> {
        const credential = await this.extract(executionContext);
        if (credential === undefined) return undefined;

        return (await this.validate(credential, executionContext)) || undefined;
    }

    /**
     * Reads the credential from the execution context.
     * @returns The credential, or `undefined` when the execution does not carry one.
     */
    protected abstract extract(executionContext: ExecutionContext): TCredential | undefined | Promise<TCredential | undefined>;

    /**
     * Checks the credential and returns the principal it identifies.
     * @returns The principal, or `undefined` when the credential is not valid.
     */
    protected abstract validate(credential: TCredential, executionContext: ExecutionContext): Promise<TPrincipal | undefined>;
}
