import { HttpTransport, HttpTransportOptions } from './http-transport';
import { LogEntry } from '../log-entry';
import { LogFormatter } from '../log-formatter';
import { LogLevel } from '../log-level';

describe('HttpTransport', () => {
    let formatter: jest.Mocked<LogFormatter>;
    let transport: HttpTransport;

    const createEntry = (level: LogLevel): LogEntry => ({
        timestamp: new Date(),
        level,
        message: 'Test',
        scopes: []
    });

    beforeEach(() => {
        formatter = {
            format: jest.fn()
        };

        transport = new HttpTransport({
            url: 'https://example.com/logs',
            formatter,
            minLevel: LogLevel.Info
        });

        global.fetch = jest.fn().mockResolvedValue({} as Response);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should send the log entry', async () => {
        const entry = createEntry(LogLevel.Info);

        await transport.write(entry);

        expect(fetch).toHaveBeenCalledWith('https://example.com/logs', {
            method: 'POST',
            signal: expect.any(AbortSignal),
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(entry)
        });

        expect(formatter.format).not.toHaveBeenCalled();
    });

    it('should abort the request after 5 seconds by default', async () => {
        const timeout = jest.spyOn(AbortSignal, 'timeout');

        await transport.write(createEntry(LogLevel.Info));

        expect(timeout).toHaveBeenCalledWith(5000);
        timeout.mockRestore();
    });

    it('should abort the request after the configured timeout', async () => {
        const timeout = jest.spyOn(AbortSignal, 'timeout');
        const withTimeout = new HttpTransport({ url: 'https://example.com/logs', formatter, minLevel: LogLevel.Info, timeout: 250 });

        await withTimeout.write(createEntry(LogLevel.Info));

        expect(timeout).toHaveBeenCalledWith(250);
        timeout.mockRestore();
    });

    it('should send the error with its name, message and stack', async () => {
        const error = new Error('Card declined');
        const entry: LogEntry = { ...createEntry(LogLevel.Error), message: 'Payment failed', error };

        await transport.write(entry);

        const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
        expect(body).toEqual({
            timestamp: entry.timestamp.toISOString(),
            level: LogLevel.Error,
            message: 'Payment failed',
            scopes: [],
            error: { name: 'Error', message: 'Card declined', stack: error.stack }
        });
    });

    it('should send the cause of the error', async () => {
        const rootCause = new TypeError('Network down');
        const error = new Error('Card declined', { cause: rootCause });
        const otherError = new Error('Timeout', { cause: { code: 'ETIMEDOUT' } });

        await transport.write({ ...createEntry(LogLevel.Error), error });
        await transport.write({ ...createEntry(LogLevel.Fatal), error: otherError });

        const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
        expect(body.error).toEqual({
            name: 'Error',
            message: 'Card declined',
            stack: error.stack,
            cause: { name: 'TypeError', message: 'Network down', stack: rootCause.stack }
        });
        expect(JSON.parse((fetch as jest.Mock).mock.calls[1][1].body).error.cause).toEqual({ code: 'ETIMEDOUT' });
    });

    it('should stop serializing circular causes', async () => {
        const error = new Error('Loop') as Error & { cause?: unknown };
        error.cause = error;

        await transport.write({ ...createEntry(LogLevel.Error), error });

        let cause = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body).error;
        let depth = 0;
        while (cause.cause) {
            cause = cause.cause;
            depth++;
        }
        expect(depth).toBe(10);
    });

    it('should include custom headers', async () => {
        transport = new HttpTransport({
            url: 'https://example.com/logs',
            formatter,
            minLevel: LogLevel.Info,
            headers: {
                Authorization: 'Bearer token'
            }
        });

        await transport.write(createEntry(LogLevel.Info));

        expect(fetch).toHaveBeenCalledWith(
            'https://example.com/logs',
            expect.objectContaining({
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer token'
                }
            })
        );
    });

    it('should not send logs below minLevel', async () => {
        await transport.write(createEntry(LogLevel.Debug));

        expect(fetch).not.toHaveBeenCalled();
    });
    describe('batches', () => {
        const batched = (batch: HttpTransportOptions['batch'], extra: Partial<HttpTransportOptions> = {}) =>
            new HttpTransport({ url: 'https://example.com/logs', formatter, minLevel: LogLevel.Info, batch, ...extra });
        const sentBodies = () => (fetch as jest.Mock).mock.calls.map(([, init]) => JSON.parse(init.body));
        const entryWith = (message: string, level = LogLevel.Info): LogEntry => ({ timestamp: new Date(0), level, message, scopes: [] });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('should send the entries as one array when the batch is full, without waiting for the request', async () => {
            let release: () => void = () => undefined;
            (fetch as jest.Mock).mockReturnValue(new Promise((resolve) => (release = () => resolve({}))));
            const transport = batched({ size: 2 });

            await transport.write(entryWith('one'));
            expect(fetch).not.toHaveBeenCalled();
            await transport.write(entryWith('two'));
            await transport.write(entryWith('debug', LogLevel.Debug));

            expect(sentBodies()).toEqual([[expect.objectContaining({ message: 'one' }), expect.objectContaining({ message: 'two' })]]);
            release();
            await transport.flush();
        });

        it('should send the pending entries after the interval', async () => {
            jest.useFakeTimers();
            const transport = batched({ interval: 500 });

            await transport.write(entryWith('one'));
            await transport.write(entryWith('two'));
            jest.advanceTimersByTime(499);
            expect(fetch).not.toHaveBeenCalled();

            jest.advanceTimersByTime(1);
            expect(sentBodies()).toEqual([[expect.objectContaining({ message: 'one' }), expect.objectContaining({ message: 'two' })]]);
        });

        it('should send the pending entries and wait for the requests in flush', async () => {
            const transport = batched(true);
            await transport.write({ ...entryWith('failed'), error: new Error('boom') });

            await transport.flush();
            await transport.flush();

            expect(fetch).toHaveBeenCalledTimes(1);
            expect(sentBodies()[0][0].error).toEqual(expect.objectContaining({ name: 'Error', message: 'boom' }));
        });

        it('should report the failures of a batch to onError for each entry', async () => {
            const error = new Error('unreachable');
            (fetch as jest.Mock).mockRejectedValue(error);
            const onError = jest.fn().mockImplementationOnce(() => {
                throw new Error('callback');
            });
            const transport = batched({ size: 2 }, { onError });

            await transport.write(entryWith('one'));
            await transport.write(entryWith('two'));
            await transport.flush();

            expect(onError).toHaveBeenCalledTimes(2);
            expect(onError).toHaveBeenCalledWith(error, expect.objectContaining({ message: 'two' }));
        });

        it('should report the failures of the batches on stderr at most once a minute', async () => {
            (fetch as jest.Mock).mockRejectedValue('offline');
            const stderr = jest.spyOn(process.stderr, 'write').mockReturnValue(true);
            const transport = batched({ size: 1 });

            await transport.write(entryWith('one'));
            await transport.flush();
            await transport.write(entryWith('two'));
            await transport.flush();

            expect(stderr).toHaveBeenCalledTimes(1);
            expect(stderr.mock.calls[0][0]).toContain('failed to send a batch of 1 entries: Error -> offline');
        });
    });
});
