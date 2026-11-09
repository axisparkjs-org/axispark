import { Cache, CacheService, NoCache } from '@axisparkjs/engine';
import { Body, CacheVary, Controller, Get, Header, HttpContext, HttpResults, NotFoundError, Path, Post } from '@axisparkjs/http';
import { catalog } from './catalog';

@Controller('products')
@Cache({ ttl: 2_000 })
export class ProductController {
    constructor(private readonly cache: CacheService) {}

    /** Cached for 2 seconds by the @Cache() of the class. The errors, such as an unknown product, are never cached. */
    @Get(':id')
    find(@Path('id') id: string) {
        const calls = catalog.count('find');
        const product = catalog.products.get(id);
        if (!product) throw new NotFoundError(`Product ${id} not found`);

        return { id: product.id, name: product.name.en, price: product.price, calls };
    }

    /** One entry per language: the accept-language header is part of the key. */
    @Get()
    @Cache({ ttl: 10_000 })
    @CacheVary('accept-language')
    list(@Header('accept-language') language?: string) {
        const calls = catalog.count('list');
        const lang = language?.startsWith('es') ? 'es' : 'en';

        return { products: [...catalog.products.values()].map((product) => product.name[lang]), calls };
    }

    /** The requests with an Authorization header are not cached by default. The custom key caches them per user. */
    @Get('recommended/me')
    @Cache({ ttl: 10_000, key: (context) => (context as HttpContext).request.getHeader('authorization') as string | undefined })
    recommended(@Header('authorization') user: string) {
        return { user, recommended: ['1'], calls: catalog.count('recommended') };
    }

    /** Files are never cached, even with @Cache(). */
    @Get(':id/manual')
    manual() {
        catalog.count('manual');
        return HttpResults.File(__filename, 'text/plain');
    }

    /** Never cached: @NoCache() disables the @Cache() of the class. */
    @Get('stats/calls')
    @NoCache()
    stats() {
        return { calls: Object.fromEntries(catalog.calls), guardChecks: catalog.guardChecks };
    }

    /** Changes the price and evicts every cached result of `find`, so the next request sees the new price. */
    @Post(':id/price')
    async changePrice(@Path('id') id: string, @Body() body: { price: number }) {
        const product = catalog.products.get(id);
        if (!product) throw new NotFoundError(`Product ${id} not found`);

        product.price = body.price;
        await this.cache.evict(ProductController, 'find');
        return product;
    }
}
