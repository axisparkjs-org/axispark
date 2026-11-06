import { HttpTransport } from './http-transport';
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
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(entry)
        });

        expect(formatter.format).not.toHaveBeenCalled();
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
});
