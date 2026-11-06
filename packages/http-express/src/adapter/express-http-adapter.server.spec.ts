import { AddressInfo, createServer as createNetServer, Server as NetServer } from 'node:net';
import { Agent, request, Server } from 'node:http';
import { ExpressHttpAdapter } from './express-http-adapter';
import { ExpressHttpPluginOptions } from '../plugin/express-http-plugin-options';
import { HttpMethod, RouteDefinition } from '@axisparkjs/http';

const options = (port: number): ExpressHttpPluginOptions =>
    ({
        port,
        basePath: '/',
        plugin: {} as never,
        adapter: {} as never,
        bodyParser: false,
        urlEncoded: false,
        session: false,
        cookies: false,
        compression: false,
        cors: false
    }) as unknown as ExpressHttpPluginOptions;

const get = (port: number, agent: Agent) =>
    new Promise<number>((resolve, reject) => {
        request({ port, path: '/ping', agent }, (response) => {
            response.resume();
            response.on('end', () => resolve(response.statusCode as number));
        })
            .on('error', reject)
            .end();
    });

describe('ExpressHttpAdapter with a real server', () => {
    let occupied: NetServer | undefined;
    let adapter: ExpressHttpAdapter | undefined;

    afterEach(async () => {
        await adapter?.stop();
        await new Promise<void>((resolve) => (occupied ? occupied.close(() => resolve()) : resolve()));
        occupied = undefined;
        adapter = undefined;
    });

    it('should reject the start when the port is already in use', async () => {
        const netServer = createNetServer();
        occupied = netServer;
        await new Promise<void>((resolve) => netServer.listen(0, () => resolve()));
        const port = (netServer.address() as AddressInfo).port;

        const busyAdapter = new ExpressHttpAdapter(options(port));
        await busyAdapter.initialize();

        await expect(busyAdapter.start()).rejects.toMatchObject({ code: 'EADDRINUSE' });
        expect(busyAdapter.getHttpServer().listening).toBe(false);
    });

    it('should resolve the stop when the server is closed, after closing the idle keep-alive connections', async () => {
        adapter = new ExpressHttpAdapter(options(0));
        await adapter.initialize();
        adapter.registerRoutes([
            new RouteDefinition(class PingController {}, 'ping', HttpMethod.Get, '/ping', [], ['*'], async ({ response }) => {
                response.status(200).send({ pong: true });
            })
        ]);
        await adapter.start();

        const server = adapter.getHttpServer() as Server;
        const port = (server.address() as AddressInfo).port;
        const agent = new Agent({ keepAlive: true });

        expect(await get(port, agent)).toBe(200);

        const started = Date.now();
        await adapter.stop();

        expect(server.listening).toBe(false);
        expect(Date.now() - started).toBeLessThan(1_000);
        agent.destroy();
    });
});
