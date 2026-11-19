import { AxiSparkTestFactory } from '@axisparkjs/test';
import { AxiSparkCore } from '@axisparkjs/core';
import { app } from '@axisparkjs/samples/same-name-classes/src/app';

describe('Same Name Classes App', () => {
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

    it('should inject the v1 UserService into the v1 UserController', async () => {
        const response = await fetch('http://localhost:3000/api/v1/users/1');
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ version: 'v1', user: { id: '1', name: 'Ada' } });
    });

    it('should inject the v2 UserService into the v2 UserController', async () => {
        const response = await fetch('http://localhost:3000/api/v2/users/1');
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ version: 'v2', user: { id: '1', firstName: 'Ada', lastName: 'Lovelace' } });
    });
});
