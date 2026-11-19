import { InjectionToken, TokenUtils, createTokenFactory } from './token';

class TestClass {}

const tokenText = 'test-token';
const token = new InjectionToken(tokenText);

describe('InjectionToken', () => {
    it('should store the description', () => {
        expect(token.description).toBe(tokenText);
    });

    it('should return the description in toString()', () => {
        expect(token.toString()).toBe(tokenText);
    });

    it('should be a different token from another token with the same description', () => {
        expect(new InjectionToken(tokenText)).not.toBe(token);
    });
});

describe('createTokenFactory', () => {
    it('should return the same token for the same key', () => {
        const connectionToken = createTokenFactory((name: string) => `CONNECTION_${name}`);

        expect(connectionToken('MAIN')).toBe(connectionToken('MAIN'));
        expect(connectionToken('MAIN').description).toBe('CONNECTION_MAIN');
    });

    it('should return different tokens for different keys', () => {
        const connectionToken = createTokenFactory((name: string) => `CONNECTION_${name}`);

        expect(connectionToken('MAIN')).not.toBe(connectionToken('REPORTS'));
    });

    it('should use the identity of object keys', () => {
        const classToken = createTokenFactory((classType: new () => unknown) => classType.name);
        const first = (() => class Repository {})();
        const second = (() => class Repository {})();

        expect(classToken(first)).toBe(classToken(first));
        expect(classToken(first)).not.toBe(classToken(second));
        expect(classToken(first).description).toBe(classToken(second).description);
    });

    it('should keep the tokens of two factories apart', () => {
        const first = createTokenFactory((name: string) => `CONNECTION_${name}`);
        const second = createTokenFactory((name: string) => `CONNECTION_${name}`);

        expect(first('MAIN')).not.toBe(second('MAIN'));
    });
});

describe('TokenUtils', () => {
    it('should return the description for an InjectionToken', () => {
        expect(TokenUtils.getName(token)).toBe(tokenText);
    });

    it('should return the constructor name for a class token', () => {
        expect(TokenUtils.getName(TestClass)).toBe('TestClass');
    });
});
