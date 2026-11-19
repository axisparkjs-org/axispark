import { AxiSparkTestFactory } from '@axisparkjs/test';
import { AxiSparkCore } from '@axisparkjs/core';
import { AdapterName, createApp } from '@axisparkjs/samples/download-names/src/app';

const ACCENTS = 'informe "año".txt';
const NON_LATIN1 = '報告 €.txt';

describe.each<[AdapterName, number]>([
    ['express', 4111],
    ['fastify', 4112]
])('Download Names App (%s)', (adapter, port) => {
    let axiSparkCore: AxiSparkCore;

    beforeAll(async () => {
        axiSparkCore = AxiSparkTestFactory.create({ app: createApp(adapter, port) });
        await axiSparkCore.init();
        await axiSparkCore.run();
    });

    afterAll(async () => {
        await axiSparkCore.destroy();
    });

    const download = (route: string, name: string) => fetch(`http://localhost:${port}/api/downloads/${route}?name=${encodeURIComponent(name)}`);

    const routes = ['stream', 'file'];
    const expectContent = async (response: Response) => {
        expect(await response.text()).toBe('Quarterly report\n');
    };

    it.each(routes)('should send a name with quotes and accents with an ASCII fallback and its UTF-8 version (%s)', async (route) => {
        const response = await download(route, ACCENTS);

        expect(response.status).toBe(200);
        expect(response.headers.get('content-disposition')).toBe(
            'attachment; filename="informe \\"a?o\\".txt"; filename*=UTF-8\'\'informe%20%22a%C3%B1o%22.txt'
        );
        await expectContent(response);
    });

    it.each(routes)('should send a name outside Latin-1 instead of failing (%s)', async (route) => {
        const response = await download(route, NON_LATIN1);

        expect(response.status).toBe(200);
        expect(response.headers.get('content-disposition')).toBe('attachment; filename="?? ?.txt"; filename*=UTF-8\'\'%E5%A0%B1%E5%91%8A%20%E2%82%AC.txt');
        await expectContent(response);
    });

    it.each(routes)('should remove the line breaks of a name taken from user data (%s)', async (route) => {
        const response = await download(route, 'report.txt\r\nSet-Cookie: session=stolen');

        expect(response.status).toBe(200);
        expect(response.headers.get('content-disposition')).toBe('attachment; filename="report.txtSet-Cookie: session=stolen"');
        expect(response.headers.get('set-cookie')).toBeNull();
    });
});
