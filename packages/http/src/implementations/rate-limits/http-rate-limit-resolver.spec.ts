import { ExecutionContext, ExecutionTransport } from '@axisparkjs/engine';
import { HttpRateLimitResolver } from './http-rate-limit-resolver';

describe('HttpRateLimitResolver', () => {
    const resolver = new HttpRateLimitResolver();

    const context = (ip?: string): ExecutionContext =>
        ({
            transport: ExecutionTransport.Http,
            request: { ip, method: 'GET', path: '/items' }
        }) as unknown as ExecutionContext;

    it('identifies the client by the IP address of the request', () => {
        expect(resolver.resolve(context('127.0.0.1'))).toBe('127.0.0.1');
    });

    it('returns undefined when the request has no IP address', () => {
        expect(resolver.resolve(context())).toBeUndefined();
    });
});
