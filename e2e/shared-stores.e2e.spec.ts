import { AxiSparkTestFactory } from '@axisparkjs/test';
import { AxiSparkCore } from '@axisparkjs/core';
import { Logger } from '@axisparkjs/logger';
import { createApp } from '@axisparkjs/samples/shared-stores/src/app';
import { createClient, RedisClientType } from 'redis';

describe('Shared Stores App', () => {
    let instances: AxiSparkCore[];
    let redis: RedisClientType;
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

    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const count = async (name: string) => Number((await redis.get(`shared-stores:executions:${name}`)) ?? 0);

    beforeAll(async () => {
        redis = createClient({ url: 'redis://localhost:6379/2' }) as RedisClientType;
        await redis.connect();
        await redis.flushDb();

        instances = [3000, 3001].map((port) => AxiSparkTestFactory.create({ app: createApp(port), providers: [{ token: Logger, useValue: mockLogger }] }));
        for (const instance of instances) await instance.init();
        for (const instance of instances) await instance.run();
        // Wait until both Redis clients are connected.
        await wait(500);
    });

    it('should share the rate limit of a client between the instances', async () => {
        expect((await fetch('http://localhost:3000/api/quotes/random')).status).toBe(200);
        expect((await fetch('http://localhost:3001/api/quotes/random')).status).toBe(200);
        expect((await fetch('http://localhost:3000/api/quotes/random')).status).toBe(200);

        const rejected = await fetch('http://localhost:3001/api/quotes/random');
        expect(rejected.status).toBe(429);
        expect(rejected.headers.get('retry-after')).toBeTruthy();
    });

    it('should keep the rate limit buckets in Redis with the configured prefix', async () => {
        const keys = await redis.keys('shared-stores:rate-limit:*');

        expect(keys).toHaveLength(1);
        expect(await redis.pTTL(keys[0])).toBeGreaterThan(0);
    });

    it('should run the exclusive job on only one instance', async () => {
        const exclusiveBefore = await count('exclusive');
        const localBefore = await count('local');

        await wait(4_000);

        const exclusive = (await count('exclusive')) - exclusiveBefore;
        const local = (await count('local')) - localBefore;
        // The local job runs on both instances, about twice as often as the exclusive job.
        expect(exclusive).toBeGreaterThanOrEqual(3);
        expect(exclusive).toBeLessThanOrEqual(5);
        expect(local).toBeGreaterThanOrEqual(exclusive * 2 - 2);
        expect(mockLogger.debug).toHaveBeenCalledWith('Job exclusiveReport skipped because another instance holds its lock');
    });

    it('should keep the locks of the exclusive job in Redis with the configured prefix', async () => {
        const keys = await redis.keys('shared-stores:lock:schedule:exclusiveReport:*');

        expect(keys.length).toBeGreaterThan(0);
    });

    afterAll(async () => {
        for (const instance of instances) await instance.destroy();
        await redis.flushDb();
        await redis.close();
    });
});
