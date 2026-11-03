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
});
