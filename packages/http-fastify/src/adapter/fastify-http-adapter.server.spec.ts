import { AddressInfo } from 'node:net';
import { FastifyHttpAdapter } from './fastify-http-adapter';
import { FastifyHttpPluginOptions } from '../plugin/fastify-http-plugin-options';

const options = (host?: string): FastifyHttpPluginOptions =>
    ({
        port: 0,
        host,
        basePath: '/',
        plugin: {} as never,
        adapter: {} as never,
        bodyParser: false,
        urlEncoded: false,
        session: false,
        cookies: false,
        compression: false,
        cors: false
    }) as unknown as FastifyHttpPluginOptions;

describe('FastifyHttpAdapter (server)', () => {
    let adapter: FastifyHttpAdapter | undefined;

    afterEach(async () => {
        await adapter?.stop();
        adapter = undefined;
    });

    const start = async (host?: string) => {
        adapter = new FastifyHttpAdapter(options(host), { basePath: __dirname } as never);
        await adapter.initialize();
        await adapter.start();
        return adapter.getHttpServer().address() as AddressInfo;
    };

    it('should listen on every network interface by default, as Node.js does', async () => {
        const address = await start();

        expect(address.address).toBe(FastifyHttpAdapter.getDefaultHost());
        expect(['::', '0.0.0.0']).toContain(address.address);
    });

    it('should listen only on the configured host', async () => {
        const address = await start('127.0.0.1');

        expect(address).toEqual(expect.objectContaining({ address: '127.0.0.1', family: 'IPv4' }));
    });
});
