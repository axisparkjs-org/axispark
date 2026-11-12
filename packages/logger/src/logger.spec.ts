import { Logger } from './logger';
import { LogLevel } from './log-level';
import { LogTransport, LogTransportOptions } from './log-transport';

class MockTransport extends LogTransport {
    write = jest.fn();
}

describe('Logger', () => {
    let transport1: MockTransport;
    let transport2: MockTransport;
    let logger: Logger;

    beforeEach(() => {
        const config: LogTransportOptions = {
            minLevel: LogLevel.Info,
            formatter: {
                format: jest.fn().mockReturnValue('formatted message')
            }
        };
        transport1 = new MockTransport(config);
        transport2 = new MockTransport(config);
        logger = new Logger([transport1, transport2]);
    });

    describe('info', () => {
        it('should log an INFO entry', async () => {
            await logger.info('info message');

            expect(transport1.write).toHaveBeenCalledTimes(1);
            expect(transport2.write).toHaveBeenCalledTimes(1);

            expect(transport1.write).toHaveBeenCalledWith(
                expect.objectContaining({
                    level: LogLevel.Info,
                    message: 'info message',
                    scopes: []
                })
            );

            expect(transport1.write.mock.calls[0][0].timestamp).toBeInstanceOf(Date);
        });
    });

    describe('warn', () => {
        it('should log a WARN entry', async () => {
            await logger.warn('warn message');

            expect(transport1.write).toHaveBeenCalledWith(
                expect.objectContaining({
                    level: LogLevel.Warn,
                    message: 'warn message',
                    scopes: []
                })
            );
        });
    });

    describe('debug', () => {
        it('should log a DEBUG entry', async () => {
            await logger.debug('debug message');

            expect(transport1.write).toHaveBeenCalledWith(
                expect.objectContaining({
                    level: LogLevel.Debug,
                    message: 'debug message',
                    scopes: []
                })
            );
        });
    });

    describe('trace', () => {
        it('should log a TRACE entry', async () => {
            await logger.trace('trace message');

            expect(transport1.write).toHaveBeenCalledWith(
                expect.objectContaining({
                    level: LogLevel.Trace,
                    message: 'trace message',
                    scopes: []
                })
            );
        });
    });

    describe('error', () => {
        it('should log an ERROR entry', async () => {
            const error = new Error('boom');

            await logger.error('error message', error);

            expect(transport1.write).toHaveBeenCalledWith(
                expect.objectContaining({
                    level: LogLevel.Error,
                    message: 'error message',
                    error,
                    scopes: []
                })
            );
        });

        it('should allow logging without an error', async () => {
            await logger.error('error message');

            expect(transport1.write).toHaveBeenCalledWith(
                expect.objectContaining({
                    level: LogLevel.Error,
                    message: 'error message',
                    error: undefined
                })
            );
        });
    });

    describe('fatal', () => {
        it('should log a FATAL entry', async () => {
            const error = new Error('fatal');

            await logger.fatal('fatal message', error);

            expect(transport1.write).toHaveBeenCalledWith(
                expect.objectContaining({
                    level: LogLevel.Fatal,
                    message: 'fatal message',
                    error,
                    scopes: []
                })
            );
        });

        it('should allow logging without an error', async () => {
            await logger.fatal('fatal message');

            expect(transport1.write).toHaveBeenCalledWith(
                expect.objectContaining({
                    level: LogLevel.Fatal,
                    message: 'fatal message',
                    error: undefined
                })
            );
        });
    });

    describe('log', () => {
        it('should log metadata', async () => {
            const metadata = {
                id: 123,
                user: 'john'
            };

            await logger.log({
                level: LogLevel.Info,
                message: 'message',
                metadata
            });

            expect(transport1.write).toHaveBeenCalledWith(
                expect.objectContaining({
                    level: LogLevel.Info,
                    message: 'message',
                    metadata,
                    scopes: []
                })
            );
        });

        it('should send the log to every transport', async () => {
            await logger.log({
                level: LogLevel.Info,
                message: 'message'
            });

            expect(transport1.write).toHaveBeenCalledTimes(1);
            expect(transport2.write).toHaveBeenCalledTimes(1);
        });

        it('should include a timestamp', async () => {
            await logger.log({
                level: LogLevel.Info,
                message: 'message'
            });

            const entry = transport1.write.mock.calls[0][0];

            expect(entry.timestamp).toBeInstanceOf(Date);
        });
    });

    describe('child', () => {
        it('should create a child logger with one scope', async () => {
            const child = logger.child('service');

            await child.info('message');

            expect(transport1.write).toHaveBeenCalledWith(
                expect.objectContaining({
                    scopes: ['service']
                })
            );
        });

        it('should accumulate scopes', async () => {
            const child = logger.child('service').child('controller').child('method');

            await child.info('message');

            expect(transport1.write).toHaveBeenCalledWith(
                expect.objectContaining({
                    scopes: ['service', 'controller', 'method']
                })
            );
        });

        it('should not modify the parent logger scopes', async () => {
            const child = logger.child('service');

            await child.info('child');
            await logger.info('parent');

            expect(transport1.write.mock.calls[0][0].scopes).toEqual(['service']);

            expect(transport1.write.mock.calls[1][0].scopes).toEqual([]);
        });
    });

    describe('metadata', () => {
        it.each(['info', 'warn', 'debug', 'trace'] as const)('should pass the metadata of %s to every transport', async (method) => {
            const metadata = { method: 'GET', path: '/users', status: 200, durationMs: 12 };

            await logger[method]('Request completed', metadata);

            for (const transport of [transport1, transport2]) {
                expect(transport.write).toHaveBeenCalledWith(expect.objectContaining({ message: 'Request completed', metadata }));
            }
        });

        it.each(['error', 'fatal'] as const)('should pass the error and the metadata of %s', async (method) => {
            const error = new Error('Card declined');

            await logger[method]('Payment failed', error, { orderId: '42' });

            expect(transport1.write).toHaveBeenCalledWith(expect.objectContaining({ message: 'Payment failed', error, metadata: { orderId: '42' } }));
        });

        it.each(['error', 'fatal'] as const)('should accept metadata in %s without an error', async (method) => {
            await logger[method]('Payment failed', undefined, { orderId: '42' });

            const entry = transport1.write.mock.calls[0][0];
            expect(entry.error).toBeUndefined();
            expect(entry.metadata).toEqual({ orderId: '42' });
        });

        it('should keep metadata undefined when none is passed', async () => {
            await logger.child('service').info('message');

            expect(transport1.write.mock.calls[0][0].metadata).toBeUndefined();
        });

        it('should add the metadata bound to a child logger to every entry', async () => {
            const requestLogger = logger.child('HttpPlugin', { requestId: 'abc' });

            await requestLogger.info('Route matched', { route: '/users/:id' });
            await requestLogger.warn('Slow request');

            expect(transport1.write.mock.calls[0][0]).toMatchObject({ scopes: ['HttpPlugin'], metadata: { requestId: 'abc', route: '/users/:id' } });
            expect(transport1.write.mock.calls[1][0].metadata).toEqual({ requestId: 'abc' });
        });

        it('should let the call metadata override the bound values with the same key', async () => {
            await logger.child('service', { requestId: 'abc', user: 'john' }).info('message', { user: 'jane' });

            expect(transport1.write.mock.calls[0][0].metadata).toEqual({ requestId: 'abc', user: 'jane' });
        });

        it('should merge the metadata of nested child loggers', async () => {
            const child = logger.child('service', { requestId: 'abc', step: 1 }).child('repository', { step: 2 }).child('query');

            await child.debug('message');
            await child.log({ level: LogLevel.Info, message: 'internal', metadata: { rows: 3 } });

            expect(transport1.write.mock.calls[0][0].metadata).toEqual({ requestId: 'abc', step: 2 });
            expect(transport1.write.mock.calls[1][0].metadata).toEqual({ requestId: 'abc', step: 2, rows: 3 });
        });

        it('should not modify the parent or the bound metadata', async () => {
            const bound = { requestId: 'abc' };
            const child = logger.child('service', bound);

            await child.info('child', { route: '/users' });
            await logger.info('parent');

            expect(bound).toEqual({ requestId: 'abc' });
            expect(transport1.write.mock.calls[1][0].metadata).toBeUndefined();
        });
    });

    describe('transport errors', () => {
        const config = (options: Partial<LogTransportOptions> = {}): LogTransportOptions => ({
            minLevel: LogLevel.Trace,
            formatter: { format: jest.fn() },
            ...options
        });

        class FailingTransport extends LogTransport {
            write = jest.fn().mockRejectedValue(new Error('log endpoint down'));
        }

        let stderr: jest.SpyInstance;

        beforeEach(() => {
            stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
        });

        afterEach(() => {
            stderr.mockRestore();
            jest.useRealTimers();
        });

        it.each(['info', 'warn', 'error', 'debug', 'trace', 'fatal'] as const)('should not reject %s() when a transport fails', async (method) => {
            const failingLogger = new Logger([new FailingTransport(config())]);

            await expect(failingLogger[method]('hello')).resolves.toBeUndefined();
        });

        it('should still send the entry to the other transports', async () => {
            const working = new MockTransport(config());
            const failingLogger = new Logger([new FailingTransport(config()), working]);

            await failingLogger.info('hello');

            expect(working.write).toHaveBeenCalledWith(expect.objectContaining({ message: 'hello' }));
        });

        it('should convert a rejection that is not an error', async () => {
            const transport = new MockTransport(config());
            transport.write.mockRejectedValue('timeout');

            await new Logger([transport]).info('hello');

            expect(stderr).toHaveBeenCalledWith(expect.stringContaining('MockTransport failed to write an entry: Error -> timeout'));
        });

        it('should report the failure on stderr at most once per transport every minute', async () => {
            jest.useFakeTimers({ now: 0 });
            const failing = new FailingTransport(config());
            const other = new FailingTransport(config());
            const failingLogger = new Logger([failing]);

            await failingLogger.info('first');
            await failingLogger.child('scope').info('second');
            await new Logger([other]).info('other transport');

            expect(stderr).toHaveBeenCalledTimes(2);
            expect(stderr).toHaveBeenCalledWith(
                '[AxiSpark] The log transport FailingTransport failed to write an entry: Error -> log endpoint down. Its next failures are not reported for 60 seconds.\n'
            );

            jest.setSystemTime(60_000);
            await failingLogger.info('third');

            expect(stderr).toHaveBeenCalledTimes(3);
        });

        it('should call onError instead of writing to stderr', async () => {
            const onError = jest.fn();
            const failing = new FailingTransport(config({ onError }));

            await new Logger([failing]).info('hello');
            await new Logger([failing]).info('again');

            expect(onError).toHaveBeenCalledTimes(2);
            expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'log endpoint down' }), expect.objectContaining({ message: 'hello' }));
            expect(stderr).not.toHaveBeenCalled();
        });

        it('should not reject when onError throws', async () => {
            const failing = new FailingTransport(
                config({
                    onError: () => {
                        throw new Error('callback failed');
                    }
                })
            );

            await expect(new Logger([failing]).info('hello')).resolves.toBeUndefined();
        });

        it('should reject with the error of a transport with failOnError, after writing to the other transports', async () => {
            const working = new MockTransport(config());
            const strict = new FailingTransport(config({ failOnError: true, onError: jest.fn() }));

            await expect(new Logger([strict, working]).info('audit')).rejects.toThrow('log endpoint down');
            expect(working.write).toHaveBeenCalled();
        });

        it('should handle transports that do not extend LogTransport', async () => {
            const duckTyped = { write: jest.fn().mockRejectedValue(new Error('down')) } as unknown as LogTransport;

            await expect(new Logger([duckTyped]).info('hello')).resolves.toBeUndefined();
        });
    });
});
