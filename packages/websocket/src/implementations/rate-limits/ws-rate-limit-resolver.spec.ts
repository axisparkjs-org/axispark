import { WsRateLimitResolver } from './ws-rate-limit-resolver';

describe('WsRateLimitResolver', () => {
    const context = (connection: any): any => ({ connection, message: { event: 'chat' } });
    const resolver = (rateLimitOptions?: any) => new WsRateLimitResolver({ rateLimitOptions } as any);

    it('identifies the clients by their remote address by default', async () => {
        await expect(resolver().resolve(context({ id: 'c1', remoteAddress: '10.0.0.1' }))).resolves.toBe('10.0.0.1');
        await expect(resolver({ by: 'address' }).resolve(context({ id: 'c1', remoteAddress: '10.0.0.1' }))).resolves.toBe('10.0.0.1');
    });

    it('falls back to the connection id when the adapter does not know the address', async () => {
        await expect(resolver().resolve(context({ id: 'c1', remoteAddress: undefined }))).resolves.toBe('c1');
    });

    it('identifies the clients by their connection id', async () => {
        await expect(resolver({ by: 'connection' }).resolve(context({ id: 'c1', remoteAddress: '10.0.0.1' }))).resolves.toBe('c1');
    });

    it('identifies the clients with a function', async () => {
        const by = jest.fn().mockResolvedValue('user-7');
        const ctx = context({ id: 'c1', remoteAddress: '10.0.0.1' });

        await expect(resolver({ by }).resolve(ctx)).resolves.toBe('user-7');
        expect(by).toHaveBeenCalledWith(ctx);
    });

    it('returns undefined without a connection', async () => {
        await expect(resolver().resolve({} as any)).resolves.toBeUndefined();
        await expect(resolver({ by: 'connection' }).resolve({} as any)).resolves.toBeUndefined();
    });
});
