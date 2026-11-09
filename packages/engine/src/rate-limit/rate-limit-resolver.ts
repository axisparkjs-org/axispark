import { Resolver } from '@axisparkjs/common';
import { ExecutionContext } from '../execution';

/**
 * Identifies the client of a request from the context of a specific transport, such as the IP address for HTTP.
 * `RateLimitProcessor` uses the identifier to build the bucket key, so the transport does not implement buckets or windows.
 * Returning `undefined` counts the request in a bucket shared by every client without an identifier.
 */
export interface RateLimitResolver extends Resolver<string | undefined> {
    resolve(context: ExecutionContext): string | undefined | Promise<string | undefined>;
}
