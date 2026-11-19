import { AxiSparkCore } from './axispark-core';
import { AxiSparkFactory } from './axispark-factory';

describe('AxiSparkFactory', () => {
    it('should create an instance of axiSparkCore', () => {
        const axiSparkCore = AxiSparkFactory.create();
        expect(axiSparkCore).toBeInstanceOf(AxiSparkCore);
    });

    it('should infer the type of the settings', () => {
        const app = AxiSparkFactory.create({ settings: { load: (env) => ({ port: env.int('AXISPARK_FACTORY_PORT', 3000) }) } });
        const port: number = app.settings.port;

        expect(port).toBe(3000);
    });
});
