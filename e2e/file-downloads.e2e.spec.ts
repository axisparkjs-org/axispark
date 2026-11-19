import { AxiSparkTestFactory } from '@axisparkjs/test';
import { AxiSparkCore } from '@axisparkjs/core';
import { AdapterName, createApp } from '@axisparkjs/samples/file-downloads/src/app';

describe.each<[AdapterName, number]>([
    ['express', 4121],
    ['fastify', 4122]
])('File Downloads App (%s)', (adapter, port) => {
    let axiSparkCore: AxiSparkCore;

    beforeAll(async () => {
        axiSparkCore = AxiSparkTestFactory.create({ app: createApp(adapter, port) });
        await axiSparkCore.init();
        await axiSparkCore.run();
    });

    afterAll(async () => {
        await axiSparkCore.destroy();
    });

    const get = (route: string) => fetch(`http://localhost:${port}/api/files/${route}`);

    it('should send a file outside the public folder', async () => {
        const response = await get('outside');

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toMatch(/^text\/plain/);
        expect(await response.text()).toBe('Hello from outside\n');
    });

    it('should send a file inside the public folder', async () => {
        const response = await get('public');

        expect(response.status).toBe(200);
        expect(await response.text()).toBe('Hello from public\n');
    });

    it('should send a file inside a folder that starts with a dot', async () => {
        const response = await get('hidden');

        expect(response.status).toBe(200);
        expect(await response.text()).toBe('Hello from a hidden folder\n');
    });

    it('should keep the content type set by the result', async () => {
        const response = await get('typed');

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toBe('application/octet-stream');
        expect(await response.text()).toBe('Hello from outside\n');
    });

    it('should send a download with its Content-Type and Content-Disposition', async () => {
        const response = await get('download');

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toMatch(/^text\/plain/);
        expect(response.headers.get('content-disposition')).toBe('attachment; filename="report.txt"');
        expect(await response.text()).toBe('Hello from outside\n');
    });

    it.each(['missing', 'download-missing'])('should answer a missing file with a 404 in the JSON format of the framework (%s)', async (route) => {
        const response = await get(route);

        expect(response.status).toBe(404);
        expect(response.headers.get('content-type')).toMatch(/^application\/json/);
        expect(response.headers.get('content-disposition')).toBeNull();
        expect(await response.json()).toEqual(expect.objectContaining({ error: 'File not found', status: 404 }));
    });

    it('should answer a relative path with a 500 that explains the error', async () => {
        const response = await get('relative');

        expect(response.status).toBe(500);
        expect(await response.json()).toEqual(expect.objectContaining({ error: expect.stringContaining('must be absolute'), status: 500 }));
    });

    it('should send a stream', async () => {
        const response = await get('stream');

        expect(response.status).toBe(200);
        expect(response.headers.get('content-disposition')).toBe('attachment; filename="stream.txt"');
        expect(await response.text()).toBe('Hello from a stream\n');
    });
});
