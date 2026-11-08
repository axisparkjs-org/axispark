import { StoreKindNotSupportedError } from './store-kind-not-supported-error';

describe('StoreKindNotSupportedError', () => {
    it('names the provider and the requested kind', () => {
        const error = new StoreKindNotSupportedError('MemoryStore', 'session');

        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe('StoreKindNotSupportedError');
        expect(error.message).toBe(`MemoryStore does not support 'session' stores.`);
    });
});
