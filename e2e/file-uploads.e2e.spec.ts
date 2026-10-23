import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { AxiSparkCore } from '@axisparkjs/core';
import { AxiSparkTestFactory } from '@axisparkjs/test';
import { HTTP_ADAPTER, HttpAdapter } from '@axisparkjs/http';
import { app as appExpress } from '@axisparkjs/samples/file-uploads/src/app-express';
import { app as appFastify } from '@axisparkjs/samples/file-uploads/src/app-fastify';

const textFile = (content: string, type = 'text/plain') => new Blob([content], { type });

describe.each([
    { name: 'Express', app: appExpress },
    { name: 'Fastify', app: appFastify }
])('File Uploads App ($name)', ({ app }) => {
    let core: AxiSparkCore;
    let baseUrl: string;

    const upload = (path: string, form: FormData) => fetch(`${baseUrl}${path}`, { method: 'POST', body: form });

    beforeAll(async () => {
        core = AxiSparkTestFactory.create({ app });
        await core.init();
        await core.run();

        const adapter = await core.get<HttpAdapter>(HTTP_ADAPTER);
        const server = adapter.getHttpServer() as Server;
        if (!server.listening) await once(server, 'listening');
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}/api`;
    });

    afterAll(async () => {
        await core?.destroy();
    });

    it('injects a single file and exposes text fields in the body', async () => {
        const form = new FormData();
        form.append('description', 'My avatar');
        form.append('tags', 'a');
        form.append('tags', 'b');
        form.append('avatar', textFile('hello'), 'avatar.txt');

        const response = await upload('/users/7/avatar', form);

        expect(response.status).toBe(201);
        expect(await response.json()).toEqual({
            id: '7',
            avatar: { fieldName: 'avatar', originalName: 'avatar.txt', mimeType: 'text/plain', size: 5 },
            content: 'hello',
            body: { description: 'My avatar', tags: ['a', 'b'] }
        });
    });

    it('injects the files of one field or all files', async () => {
        const form = new FormData();
        form.append('documents', textFile('one'), 'one.txt');
        form.append('documents', textFile('two'), 'two.txt');
        form.append('other', textFile('three'), 'three.txt');

        const documents = await upload('/users/documents', form);
        expect(documents.status).toBe(201);
        expect(((await documents.json()) as { documents: { originalName: string }[] }).documents.map((file) => file.originalName)).toEqual([
            'one.txt',
            'two.txt'
        ]);

        const all = await upload('/users/all', form);
        expect(all.status).toBe(201);
        expect(await all.json()).toEqual({ files: ['documents', 'documents', 'other'] });
    });

    it('returns 413 with the configured message when a file exceeds the global size', async () => {
        const form = new FormData();
        form.append('avatar', textFile('x'.repeat(2048)), 'big.txt');

        const response = await upload('/users/1/avatar', form);

        expect(response.status).toBe(413);
        expect(await response.json()).toEqual({ status: 413, error: 'Upload rejected (fileSize): limit is 1024' });
    });

    it('rejects a large file mid-stream with 413', async () => {
        const form = new FormData();
        form.append('avatar', textFile('x'.repeat(2 * 1024 * 1024)), 'huge.txt');

        const response = await upload('/users/1/avatar', form);

        expect(response.status).toBe(413);
    });

    it('returns 413 when the global number of files is exceeded', async () => {
        const form = new FormData();
        for (let i = 0; i < 4; i++) form.append('documents', textFile('doc'), `doc-${i}.txt`);

        const response = await upload('/users/documents', form);

        expect(response.status).toBe(413);
        expect(await response.json()).toEqual({ status: 413, error: 'Upload rejected (files): limit is 3' });
    });

    it('returns 415 when the MIME type is not allowed', async () => {
        const form = new FormData();
        form.append('avatar', textFile('<svg/>', 'image/svg+xml'), 'avatar.svg');

        const response = await upload('/users/1/avatar', form);

        expect(response.status).toBe(415);
        expect(await response.json()).toEqual({ status: 415, error: 'Upload rejected (mimeType): limit is 2' });
    });

    it('applies handler overrides and falls back to global values for missing ones', async () => {
        const accepted = new FormData();
        accepted.append('file', textFile('x'.repeat(2048), 'application/pdf'), 'contract.pdf');
        const acceptedResponse = await upload('/users/contracts', accepted);
        expect(acceptedResponse.status).toBe(201);
        expect(await acceptedResponse.json()).toEqual({
            contract: { fieldName: 'file', originalName: 'contract.pdf', mimeType: 'application/pdf', size: 2048 }
        });

        const wrongType = new FormData();
        wrongType.append('file', textFile('text'), 'contract.txt');
        expect((await upload('/users/contracts', wrongType)).status).toBe(415);

        const tooBig = new FormData();
        tooBig.append('file', textFile('x'.repeat(5000), 'application/pdf'), 'contract.pdf');
        expect((await upload('/users/contracts', tooBig)).status).toBe(413);
    });

    it('applies controller limits with handler precedence', async () => {
        const form = new FormData();
        form.append('a', textFile('a'), 'a.txt');
        form.append('b', textFile('b'), 'b.txt');

        expect((await upload('/single/inherited', form)).status).toBe(413);

        const override = await upload('/single/override', form);
        expect(override.status).toBe(201);
        expect(await override.json()).toEqual({ files: 2 });
    });
});
