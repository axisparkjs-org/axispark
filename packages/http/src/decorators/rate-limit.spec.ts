import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { NoRateLimit, RateLimit } from './rate-limit';

describe('RateLimit decorators', () => {
    class TestController {
        handler() {}
        publicHandler() {}
    }

    it('stores rate limit options on a controller', () => {
        RateLimit({ ttl: 5_000, limit: 10 })(TestController);

        expect(Metadata.get(MetadataKeys.RATE_LIMIT, TestController)).toEqual(
            expect.objectContaining({
                target: TestController,
                disabled: false,
                options: { ttl: 5_000, limit: 10 }
            })
        );
    });

    it('stores partial rate limit options on a handler', () => {
        RateLimit({ limit: 3 })(
            TestController.prototype,
            'handler',
            Object.getOwnPropertyDescriptor(TestController.prototype, 'handler') as PropertyDescriptor
        );

        expect(Metadata.get(MetadataKeys.RATE_LIMIT, TestController, 'handler')).toEqual(
            expect.objectContaining({
                target: TestController,
                propertyKey: 'handler',
                disabled: false,
                options: { limit: 3 }
            })
        );
    });

    it('marks controllers and handlers as excluded when using NoRateLimit', () => {
        NoRateLimit()(TestController);
        NoRateLimit()(
            TestController.prototype,
            'publicHandler',
            Object.getOwnPropertyDescriptor(TestController.prototype, 'publicHandler') as PropertyDescriptor
        );

        expect(Metadata.get(MetadataKeys.RATE_LIMIT, TestController)).toEqual(expect.objectContaining({ disabled: true }));
        expect(Metadata.get(MetadataKeys.RATE_LIMIT, TestController, 'publicHandler')).toEqual(expect.objectContaining({ disabled: true }));
    });
});
