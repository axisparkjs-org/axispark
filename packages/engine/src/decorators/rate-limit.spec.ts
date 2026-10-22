import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { NoRateLimit, RateLimit } from './rate-limit';

describe('Rate limit decorators', () => {
    class TestController {
        handle() {}
    }

    it('stores rate limit settings on a class', () => {
        RateLimit({ ttl: 5_000, limit: 10 })(TestController);

        expect(Metadata.get(MetadataKeys.RATE_LIMIT, TestController)).toEqual(
            expect.objectContaining({ target: TestController, disabled: false, options: { ttl: 5_000, limit: 10 } })
        );
    });

    it('stores partial rate limit settings on a method', () => {
        RateLimit({ limit: 3 })(TestController.prototype, 'handle', Object.getOwnPropertyDescriptor(TestController.prototype, 'handle') as PropertyDescriptor);

        expect(Metadata.get(MetadataKeys.RATE_LIMIT, TestController, 'handle')).toEqual(
            expect.objectContaining({ target: TestController, propertyKey: 'handle', disabled: false, options: { limit: 3 } })
        );
    });

    it('marks classes and methods as excluded with NoRateLimit', () => {
        NoRateLimit()(TestController);
        NoRateLimit()(TestController.prototype, 'handle', Object.getOwnPropertyDescriptor(TestController.prototype, 'handle') as PropertyDescriptor);

        expect(Metadata.get(MetadataKeys.RATE_LIMIT, TestController)).toEqual(expect.objectContaining({ disabled: true }));
        expect(Metadata.get(MetadataKeys.RATE_LIMIT, TestController, 'handle')).toEqual(expect.objectContaining({ disabled: true }));
    });
});
