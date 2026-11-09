import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { Injectable } from '@axisparkjs/di';
import { CacheDefinition, CacheResolver, ExecutionContext } from '@axisparkjs/engine';
import { CacheVaryMetadata } from '../../metadata/cache-vary-metadata';
import { HttpContext } from '../../types';

const CACHEABLE_METHODS = new Set(['GET', 'HEAD']);
const PRIVATE_HEADERS = ['authorization', 'cookie'];

/**
 * Builds the cache key of the HTTP requests. Only `GET` and `HEAD` requests are cached, and the key is made of the method, the host,
 * the path, the sorted query string and the headers of `@CacheVary()`.
 *
 * The requests with an `Authorization` or `Cookie` header are not cached, so the response of one user is never returned to another one.
 * A custom `key` in `@Cache()`, such as `(ctx) => ctx.session.userId`, replaces the method, host, path and query of the key, and enables
 * the cache of these requests explicitly.
 */
@Injectable()
export class HttpCacheResolver implements CacheResolver {
    public async resolve(context: ExecutionContext, definition: CacheDefinition): Promise<string | undefined> {
        const { request } = context as HttpContext;
        const method = request.method.toUpperCase();
        if (!CACHEABLE_METHODS.has(method)) return undefined;

        let key: string | undefined;
        if (definition.key) {
            key = definition.key(context);
        } else {
            if (PRIVATE_HEADERS.some((header) => this.hasHeader(request.headers[header]))) return undefined;
            key = JSON.stringify([method, request.headers.host ?? '', request.path, this.sortQuery(request.query)]);
        }
        if (key === undefined) return undefined;

        const vary = this.getVaryHeaders(context);
        if (vary.length === 0) return key;

        return `${key}:${JSON.stringify(vary.map((header) => [header, this.headerValue(request.headers[header])]))}`;
    }

    private getVaryHeaders(context: ExecutionContext): string[] {
        const metadata =
            Metadata.get<CacheVaryMetadata>(MetadataKeys.CACHE_VARY, context.target, context.propertyKey) ??
            Metadata.get<CacheVaryMetadata>(MetadataKeys.CACHE_VARY, context.target);
        return metadata?.headers ?? [];
    }

    private sortQuery(query: Readonly<Record<string, string | string[]>>): [string, string | string[]][] {
        return Object.entries(query ?? {}).sort(([a], [b]) => (a < b ? -1 : 1));
    }

    private hasHeader(value: string | string[] | undefined): boolean {
        return Array.isArray(value) ? value.length > 0 : value !== undefined && value !== '';
    }

    private headerValue(value: string | string[] | undefined): string {
        return Array.isArray(value) ? value.join(', ') : (value ?? '');
    }
}
