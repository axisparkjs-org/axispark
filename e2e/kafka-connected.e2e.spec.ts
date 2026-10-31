import { AxiSparkTestFactory } from '@axisparkjs/test';
import { AxiSparkCore, HealthEngine } from '@axisparkjs/core';
import { KafkaPlugin } from '@axisparkjs/kafka';
import { app } from '@axisparkjs/samples/kafka-connected/src/app';
import { Logger } from '@axisparkjs/logger';

describe('Kafka Connected App', () => {
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
                    type: KafkaPlugin,
                    options: expect.objectContaining({
                        connections: expect.any(Array),
                        plugin: KafkaPlugin
                    })
                }
            ])
        );
    });

    it('should log the connection status info', async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Kafka Connection 1 defined: true'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Kafka Connection 2 defined: true'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Kafka Connection 3 defined: true'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Kafka Consumer 1 defined: true'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Kafka Consumer 2 defined: true'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Kafka Consumer 3 defined: true'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Kafka Consumer 4 defined: false'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Kafka Producer 1 defined: true'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Kafka Producer 2 defined: true'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Kafka Producer 3 defined: true'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Kafka Producer 4 defined: false'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Kafka Connection Manager has 4 connections'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Kafka Connection Manager has connections: 1, 2, 3, 4'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Connection 1 compared to Manager: true'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Consumer 1 compared to Manager: true'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Producer 1 compared to Manager: true'));
    });

    it('should report the broken connection as unhealthy', async () => {
        const healthEngine = await axiSparkCore.get(HealthEngine);

        const checks = await healthEngine.checkAll();

        expect(checks[0].status).toBe('unhealthy');
        expect(checks).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    component: 'kafka:1',
                    status: 'healthy',
                    details: expect.objectContaining({ critical: true })
                }),
                expect.objectContaining({
                    component: 'kafka:2',
                    status: 'healthy',
                    details: expect.objectContaining({ critical: true })
                }),
                expect.objectContaining({
                    component: 'kafka:3',
                    status: 'healthy',
                    details: expect.objectContaining({ critical: true })
                }),
                expect.objectContaining({
                    component: 'kafka:4',
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
