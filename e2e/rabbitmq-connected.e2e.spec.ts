import { AxiSparkTestFactory } from '@axisparkjs/test';
import { AxiSparkCore, HealthEngine } from '@axisparkjs/core';
import { RabbitMQPlugin } from '@axisparkjs/rabbitmq';
import { app } from '@axisparkjs/samples/rabbitmq-connected/src/app';
import { Logger } from '@axisparkjs/logger';

describe('RabbitMQ Connected App', () => {
    let axiSparkCore: AxiSparkCore;
    const mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        trace: jest.fn(),
        fatal: jest.fn(),
        child: jest.fn().mockReturnThis(),
        log: jest.fn()
    } as unknown as jest.Mocked<Logger>;

    beforeAll(async () => {
        axiSparkCore = AxiSparkTestFactory.create({
            app,
            providers: [{ token: Logger, useValue: mockLogger }]
        });
        await axiSparkCore.init();
        await axiSparkCore.run();
    });

    it('should create an instance of AxiSparkTestCore', () => {
        expect(axiSparkCore).toBeInstanceOf(AxiSparkCore);
    });

    it('should create the app with RabbitMQ plugin', async () => {
        const plugins = axiSparkCore.used();
        expect(plugins).toHaveLength(2);
        expect(plugins).toStrictEqual(
            expect.arrayContaining([
                {
                    type: RabbitMQPlugin,
                    options: expect.objectContaining({
                        connections: expect.any(Array),
                        plugin: RabbitMQPlugin
                    })
                }
            ])
        );
    });

    it('should log the connection status info', async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('RabbitMQ Connection 1 is connected: true'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('RabbitMQ Connection 2 is connected: true'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('RabbitMQ Connection 3 is connected: false'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('RabbitMQ Connection Manager has 3 connections'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('RabbitMQ Connection Manager has connections: 1, 2, 3'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Connection 1 compared to Manager: true'));
    });

    it('should report the broken connection as unhealthy', async () => {
        const healthEngine = await axiSparkCore.get(HealthEngine);

        const checks = await healthEngine.checkAll();

        expect(checks[0].status).toBe('unhealthy');
        expect(checks).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    component: 'rabbitmq:1',
                    status: 'healthy',
                    details: expect.objectContaining({ critical: true })
                }),
                expect.objectContaining({
                    component: 'rabbitmq:2',
                    status: 'healthy',
                    details: expect.objectContaining({ critical: true })
                }),
                expect.objectContaining({
                    component: 'rabbitmq:3',
                    status: 'unhealthy',
                    details: expect.objectContaining({ critical: true, error: expect.any(String) })
                })
            ])
        );
    });

    afterAll(async () => {
        await axiSparkCore.destroy();
    });
});
