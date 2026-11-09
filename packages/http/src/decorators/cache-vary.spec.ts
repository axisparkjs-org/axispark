import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { CacheVary } from './cache-vary';

describe('CacheVary', () => {
    class ProductController {
        find() {}
    }

    it('stores the headers of a class in lower case, sorted and without duplicates', () => {
        CacheVary('X-Tenant', 'Accept-Language', 'accept-language')(ProductController);

        expect(Metadata.get(MetadataKeys.CACHE_VARY, ProductController)).toEqual({
            target: ProductController,
            propertyKey: undefined,
            headers: ['accept-language', 'x-tenant']
        });
    });

    it('stores the headers of a method', () => {
        CacheVary('Accept')(ProductController.prototype, 'find', Object.getOwnPropertyDescriptor(ProductController.prototype, 'find') as PropertyDescriptor);

        expect(Metadata.get(MetadataKeys.CACHE_VARY, ProductController, 'find')).toEqual({
            target: ProductController,
            propertyKey: 'find',
            headers: ['accept']
        });
    });
});
