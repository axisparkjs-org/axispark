import { AddressInfo } from 'node:net';
import { AxiSparkTestFactory } from '@axisparkjs/test';
import { AxiSparkCore } from '@axisparkjs/core';
import { HTTP_ADAPTER, HttpAdapter } from '@axisparkjs/http';
import { createApp as createExpressApp } from '@axisparkjs/samples/listening-address/src/app.express';
import { createApp as createFastifyApp } from '@axisparkjs/samples/listening-address/src/app.fastify';

describe('Listening Address Apps', () => {
    const listen = async (createApp: typeof createExpressApp, host?: string) => {
        const axiSparkCore: AxiSparkCore = AxiSparkTestFactory.create({ app: createApp(host) });
        await axiSparkCore.init();
        await axiSparkCore.run();
        try {
            const adapter = await axiSparkCore.get<HttpAdapter>(HTTP_ADAPTER);
            const address = adapter.getHttpServer().address() as AddressInfo;
            const response = await fetch(`http://127.0.0.1:${address.port}/api/status`);
            expect(response.status).toBe(200);
            return address.address;
        } finally {
            await axiSparkCore.destroy();
        }
    };

    it('should listen on the same address with both adapters by default', async () => {
        const expressAddress = await listen(createExpressApp);
        const fastifyAddress = await listen(createFastifyApp);

        expect(['::', '0.0.0.0']).toContain(expressAddress);
        expect(fastifyAddress).toBe(expressAddress);
    });

    it('should listen only on the loopback interface with host 127.0.0.1 with both adapters', async () => {
        await expect(listen(createExpressApp, '127.0.0.1')).resolves.toBe('127.0.0.1');
        await expect(listen(createFastifyApp, '127.0.0.1')).resolves.toBe('127.0.0.1');
    });
});
