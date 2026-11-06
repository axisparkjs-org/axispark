import { AxiSparkTestFactory } from '@axisparkjs/test';
import { AxiSparkCore, HealthEngine } from '@axisparkjs/core';
import { RedisConnectionManager, RedisPlugin } from '@axisparkjs/redis';
import { app } from '@axisparkjs/samples/redis-connected/src/app';
import { Logger } from '@axisparkjs/logger';

describe('Redis Connected App', () => {
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

    it('should create the app with Redis plugin', async () => {
        const plugins = axiSparkCore.used();
        expect(plugins).toHaveLength(2);
        expect(plugins).toStrictEqual(
            expect.arrayContaining([
                {
                    type: RedisPlugin,
                    options: expect.objectContaining({
                        connections: expect.any(Array),
                        healthChecks: true,
                        plugin: RedisPlugin
                    })
                }
            ])
        );
    });

    it('should use the injected connections', async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Session 42 belongs to: Ada'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Redis Connection CACHE is ready: true'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Redis Connection LOCKS is ready: true'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Redis Connection BROKEN is ready: false'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Redis Connection Manager has connections: CACHE, LOCKS, BROKEN'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Connection CACHE compared to Manager: true'));
    });

    it('should log the errors and reconnections of the broken connection without stopping the process', () => {
        expect(mockLogger.error).toHaveBeenCalledWith(
            "Connection 'BROKEN' encountered an error",
            expect.objectContaining({ code: 'ECONNREFUSED' })
        );
        expect(mockLogger.warn).toHaveBeenCalledWith("Connection 'BROKEN' reconnecting");
        expect(mockLogger.info).toHaveBeenCalledWith("Connection 'CACHE' established");
    });

    it('should report the broken connection as unhealthy', async () => {
        const healthEngine = await axiSparkCore.get(HealthEngine);

        const checks = await healthEngine.checkAll();

        expect(checks).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    component: 'redis:CACHE',
                    status: 'healthy',
                    details: expect.objectContaining({ critical: true, latencyMs: expect.any(Number) })
                }),
                expect.objectContaining({
                    component: 'redis:LOCKS',
                    status: 'healthy',
                    details: expect.objectContaining({ critical: true, latencyMs: expect.any(Number) })
                }),
                expect.objectContaining({
                    component: 'redis:BROKEN',
                    status: 'unhealthy',
                    details: expect.objectContaining({ critical: true, error: 'Client is not ready' })
                })
            ])
        );
    });

    it('should close every connection when the application stops', async () => {
        const connections = (await axiSparkCore.get(RedisConnectionManager)).getAllConnections();

        await axiSparkCore.destroy();

        for (const connection of connections.values()) expect(connection.isOpen).toBe(false);
        expect(mockLogger.info).toHaveBeenCalledWith("Connection 'CACHE' finished");
    });
});
