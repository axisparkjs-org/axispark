import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { Cache, NoCache } from './cache';

describe('Cache decorators', () => {
    class TestController {
        handle() {}
    }
    const descriptor = () => Object.getOwnPropertyDescriptor(TestController.prototype, 'handle') as PropertyDescriptor;

    it('stores the cache options on a class', () => {
        Cache({ ttl: 5_000 })(TestController);

        expect(Metadata.get(MetadataKeys.CACHE, TestController)).toEqual(
            expect.objectContaining({ target: TestController, disabled: false, options: { ttl: 5_000 } })
        );
    });

    it('stores the cache options on a method, with empty options by default', () => {
        Cache()(TestController.prototype, 'handle', descriptor());

        expect(Metadata.get(MetadataKeys.CACHE, TestController, 'handle')).toEqual(
            expect.objectContaining({ target: TestController, propertyKey: 'handle', disabled: false, options: {} })
        );
    });

    it('stores a custom key function', () => {
        const key = () => 'user-1';
        Cache({ key })(TestController.prototype, 'handle', descriptor());

        expect(Metadata.get<any>(MetadataKeys.CACHE, TestController, 'handle').options.key).toBe(key);
    });

    it('marks classes and methods as not cached with NoCache', () => {
        NoCache()(TestController);
        NoCache()(TestController.prototype, 'handle', descriptor());

        expect(Metadata.get(MetadataKeys.CACHE, TestController)).toEqual(expect.objectContaining({ disabled: true }));
        expect(Metadata.get(MetadataKeys.CACHE, TestController, 'handle')).toEqual(expect.objectContaining({ disabled: true }));
    });

    it.each([0, -1, Number.NaN, '10' as unknown as number])('rejects the invalid ttl %p', (ttl) => {
        expect(() => Cache({ ttl })).toThrow('the ttl of @Cache() must be a number of milliseconds greater than 0');
    });
});
