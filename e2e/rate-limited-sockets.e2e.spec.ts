import { AxiSparkTestFactory } from '@axisparkjs/test';
import { AxiSparkCore } from '@axisparkjs/core';
import { app } from '@axisparkjs/samples/rate-limited-sockets/src/app';
import { createClient, RedisClientType } from 'redis';
import { io, Socket } from 'socket.io-client';

describe('Rate Limited Sockets App', () => {
    let axiSparkCore: AxiSparkCore;
    let redis: RedisClientType;
    let socket: Socket;

    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const connect = () => io('http://localhost:3000', { path: '/websocket', forceNew: true });
    const emit = (event: string, data?: unknown) => new Promise<any>((resolve) => socket.emit(event, data, (response: unknown) => resolve(response)));

    beforeAll(async () => {
        redis = createClient({ url: 'redis://localhost:6379/3' }) as RedisClientType;
        await redis.connect();
        await redis.flushDb();

        axiSparkCore = AxiSparkTestFactory.create({ app });
        await axiSparkCore.init();
        await axiSparkCore.run();
        // Wait until the Redis client of the application is connected.
        await wait(500);
    });

    beforeEach(() => {
        socket = connect();
    });

    afterEach(() => {
        socket.disconnect();
    });

    it('should reject the events beyond the limit of the event with a 429 error and the retry time', async () => {
        for (let i = 0; i < 3; i++) expect(await emit('chat:send', { text: `hello ${i}` })).toEqual({ received: `hello ${i}` });

        const rejected = await emit('chat:send', { text: 'too many' });

        expect(rejected).toEqual(expect.objectContaining({ error: 'Too many requests. Please try again later.', status: 429 }));
        expect(rejected.retryAfterMs).toBeGreaterThan(0);
        expect(rejected.retryAfterMs).toBeLessThanOrEqual(10_000);
    });

    it('should not invoke the handler of a rejected event', async () => {
        expect(await emit('chat:sent')).toEqual({ sent: 3 });
    });

    it('should not reset the limits when the client reconnects', async () => {
        expect(await emit('chat:send', { text: 'after reconnecting' })).toEqual(expect.objectContaining({ status: 429 }));
    });

    it('should never limit an event with @NoRateLimit()', async () => {
        for (let i = 0; i < 10; i++) expect(await emit('chat:sent')).toEqual({ sent: 3 });
    });

    it('should apply the default limits of the plugin to the other events', async () => {
        for (let i = 0; i < 5; i++) expect(await emit('ping')).toEqual({ pong: true });

        expect(await emit('ping')).toEqual(expect.objectContaining({ status: 429 }));
    });

    it('should keep the HTTP rate limits apart from the WebSocket ones', async () => {
        for (let i = 0; i < 3; i++) expect((await fetch('http://localhost:3000/api/quotes/random')).status).toBe(200);

        expect((await fetch('http://localhost:3000/api/quotes/random')).status).toBe(429);
    });

    it('should count the WebSocket events in Redis and the HTTP requests in the memory of the process', async () => {
        const keys = await redis.keys('rate-limited-sockets:rate-limit:*');

        expect(keys.length).toBe(2);
        expect(keys.every((key) => key.includes('"websocket"'))).toBe(true);
        expect(keys.some((key) => key.includes('"send"'))).toBe(true);
        expect(keys.some((key) => key.includes('"ping"'))).toBe(true);
    });

    afterAll(async () => {
        await axiSparkCore.destroy();
        await redis.flushDb();
        await redis.close();
    });
});
