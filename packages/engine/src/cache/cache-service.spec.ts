import { CacheProcessor } from './cache-processor';
import { CacheService } from './cache-service';

describe('CacheService', () => {
    class ProductController {
        find() {}
    }

    it('evicts the entries of a handler with the processor', async () => {
        const processor = { evict: jest.fn() } as unknown as jest.Mocked<CacheProcessor>;
        const service = new CacheService(processor);

        await service.evict(ProductController, 'find');
        await service.evict(ProductController, 'find', 'key');

        expect(processor.evict).toHaveBeenCalledWith(ProductController, 'find', undefined);
        expect(processor.evict).toHaveBeenCalledWith(ProductController, 'find', 'key');
    });
});
