import { Injectable } from '@axisparkjs/di';
import { ExecutionContext, RateLimitResolver } from '@axisparkjs/engine';
import { HttpContext } from '../../types';

/**
 * Identifies the HTTP clients by their IP address. `RateLimitProcessor` counts the requests per client and handler,
 * so every request to a route shares the same limit, whatever the values of its path parameters and its query string.
 */
@Injectable()
export class HttpRateLimitResolver implements RateLimitResolver {
    public resolve(context: ExecutionContext): string | undefined {
        return (context as HttpContext).request.ip;
    }
}
