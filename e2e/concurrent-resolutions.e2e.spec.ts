import { AxiSparkTestFactory } from '@axisparkjs/test';
import { AxiSparkCore } from '@axisparkjs/core';
import { app } from '@axisparkjs/samples/concurrent-resolutions/src/app';
import { RemoteConfig } from '@axisparkjs/samples/concurrent-resolutions/src/remote-config';

describe('Concurrent Resolutions App', () => {
    let axiSparkCore: AxiSparkCore;

    beforeAll(async () => {
        axiSparkCore = AxiSparkTestFactory.create({
            app
        });
        await axiSparkCore.init();
        await axiSparkCore.run();
    });

    afterAll(async () => {
        await axiSparkCore.destroy();
    });

    it('should answer the requests sent at the same time while the asynchronous factory of a singleton is running', async () => {
        const responses = await Promise.all([
            fetch('http://localhost:3000/api/greeting'),
            fetch('http://localhost:3000/api/status'),
            fetch('http://localhost:3000/api/greeting'),
            fetch('http://localhost:3000/api/status')
        ]);

        expect(responses.map((response) => response.status)).toEqual([200, 200, 200, 200]);
        const [greeting1, status1, greeting2, status2] = await Promise.all(responses.map((response) => response.json()));
        expect(greeting1).toEqual({ greeting: 'Hello from the remote configuration', instance: 1 });
        expect(greeting2).toEqual(greeting1);
        expect(status1).toEqual({ status: 'UP' });
        expect(status2).toEqual({ status: 'UP' });
    });

    it('should create the singleton only once', async () => {
        const response = await fetch('http://localhost:3000/api/greeting');

        expect(await response.json()).toEqual({ greeting: 'Hello from the remote configuration', instance: 1 });
        expect(RemoteConfig.created).toBe(1);
    });
});
