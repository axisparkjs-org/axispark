import { request } from 'node:http';
import { AxiSparkTestFactory } from '@axisparkjs/test';
import { AxiSparkCore } from '@axisparkjs/core';
import { Logger } from '@axisparkjs/logger';
import { AdapterName, createApp } from '@axisparkjs/samples/stream-errors/src/app';
import { endless } from '@axisparkjs/samples/stream-errors/src/controller';

const waitFor = async (condition: () => boolean, timeout = 2000) => {
    const start = Date.now();
    while (!condition()) {
        if (Date.now() - start > timeout) throw new Error('Timed out');
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
};

describe.each<[AdapterName, number]>([
    ['express', 4131],
    ['fastify', 4132]
])('Stream Errors App (%s)', (adapter, port) => {
    let axiSparkCore: AxiSparkCore;
    const mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        trace: jest.fn(),
        fatal: jest.fn(),
        log: jest.fn(),
        child: jest.fn()
    } as unknown as jest.Mocked<Logger>;
    mockLogger.child.mockReturnValue(mockLogger);
    const uncaught = jest.fn();

    beforeAll(async () => {
        process.on('uncaughtException', uncaught);
        axiSparkCore = AxiSparkTestFactory.create({ app: createApp(adapter, port), providers: [{ token: Logger, useValue: mockLogger }] });
        await axiSparkCore.init();
        await axiSparkCore.run();
    });

    afterAll(async () => {
        await axiSparkCore.destroy();
        process.off('uncaughtException', uncaught);
    });

    beforeEach(() => {
        mockLogger.error.mockClear();
    });

    const url = (route: string) => `http://localhost:${port}/api/streams/${route}`;

    it('should send a stream', async () => {
        const response = await fetch(url('ok'));

        expect(response.status).toBe(200);
        expect(await response.text()).toBe('Hello from a stream\n');
    });

    it('should answer a stream that fails before the first chunk with a 500 in the JSON format of the framework', async () => {
        const response = await fetch(url('fail-before'));

        expect(response.status).toBe(500);
        expect(response.headers.get('content-type')).toMatch(/^application\/json/);
        expect(response.headers.get('content-disposition')).toBeNull();
        expect(await response.json()).toEqual(expect.objectContaining({ error: 'Stream failed', status: 500 }));
        await waitFor(() => mockLogger.error.mock.calls.length > 0);
        expect(mockLogger.error).toHaveBeenCalledWith(
            'Error while sending the response of StreamController.failBefore: Error -> upstream failed',
            expect.any(Error)
        );
    });

    it('should close the connection when the stream fails in the middle of the transfer', async () => {
        const response = await fetch(url('fail-during'));

        expect(response.status).toBe(200);
        await expect(response.text()).rejects.toThrow();
        await waitFor(() => mockLogger.error.mock.calls.length > 0);
        expect(mockLogger.error).toHaveBeenCalledWith(
            'Error while sending the response of StreamController.failDuring: Error -> upstream failed in the middle',
            expect.any(Error)
        );
    });

    it('should destroy the source when the client disconnects', async () => {
        endless.stream = undefined;
        await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('No data received')), 2000);
            const req = request(url('endless'), (response) => {
                response.once('data', () => {
                    clearTimeout(timer);
                    req.destroy();
                    resolve();
                });
            });
            req.on('error', () => undefined);
            req.end();
        });

        await waitFor(() => endless.stream?.destroyed === true);
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should keep the process running', async () => {
        expect(uncaught).not.toHaveBeenCalled();
        const response = await fetch(url('ok'));
        expect(response.status).toBe(200);
    });
});
