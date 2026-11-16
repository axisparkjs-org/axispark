import { LogLevel } from '../log-level';
import { LogEntry } from '../log-entry';
import { LogFormatter } from '../log-formatter';

const streams: { write: jest.Mock; flush: jest.Mock; flushSync: jest.Mock; options: unknown }[] = [];

jest.mock('sonic-boom', () => ({
    SonicBoom: jest.fn().mockImplementation((options: unknown) => {
        const stream = {
            options,
            write: jest.fn(),
            flush: jest.fn((callback?: () => void) => callback?.()),
            flushSync: jest.fn()
        };
        streams.push(stream);
        return stream;
    })
}));

const entry = (level: LogLevel): LogEntry => ({ timestamp: new Date(), level, message: 'Test', scopes: [] });

describe('ConsoleTransport', () => {
    let formatter: jest.Mocked<LogFormatter>;
    let ConsoleTransport: typeof import('./console-transport').ConsoleTransport;
    let exitListeners: (() => void)[];

    beforeEach(() => {
        jest.isolateModules(() => {
            ConsoleTransport = jest.requireActual<typeof import('./console-transport')>('./console-transport').ConsoleTransport;
        });
        streams.length = 0;
        exitListeners = [];
        jest.spyOn(process, 'on').mockImplementation(((event: string, listener: () => void) => {
            if (event === 'exit') exitListeners.push(listener);
            return process;
        }) as any);
        formatter = { format: jest.fn().mockReturnValue('formatted message') };
        jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    it('should write the formatted entries at or above the minimum level to a buffered stream of the standard output', async () => {
        const transport = new ConsoleTransport({ minLevel: LogLevel.Info, formatter });

        await transport.write(entry(LogLevel.Info));
        await transport.write(entry(LogLevel.Error));
        await transport.write(entry(LogLevel.Debug));

        expect(streams).toHaveLength(1);
        expect(streams[0].options).toEqual({ fd: process.stdout.fd ?? 1, sync: false, minLength: 4096 });
        expect(streams[0].write).toHaveBeenCalledTimes(2);
        expect(streams[0].write).toHaveBeenCalledWith('formatted message\n');
        expect(formatter.format).toHaveBeenCalledTimes(2);
        expect(console.log).not.toHaveBeenCalled();
    });

    it('should share one stream between the console transports and flush it once at the end of the tick', async () => {
        const first = new ConsoleTransport({ minLevel: LogLevel.Info, formatter });
        const second = new ConsoleTransport({ minLevel: LogLevel.Info, formatter });

        await first.write(entry(LogLevel.Info));
        await second.write(entry(LogLevel.Info));
        expect(streams[0].flush).not.toHaveBeenCalled();

        await new Promise((resolve) => setImmediate(resolve));

        expect(streams).toHaveLength(1);
        expect(streams[0].flush).toHaveBeenCalledTimes(1);
    });

    it('should write the buffer synchronously when the process exits, also when the standard output is closed', async () => {
        await new ConsoleTransport({ minLevel: LogLevel.Info, formatter }).write(entry(LogLevel.Info));

        exitListeners.forEach((listener) => listener());
        expect(streams[0].flushSync).toHaveBeenCalledTimes(1);

        streams[0].flushSync.mockImplementation(() => {
            throw new Error('closed');
        });
        expect(() => exitListeners.forEach((listener) => listener())).not.toThrow();
    });

    it('should wait for the buffer in flush, and do nothing before the first entry', async () => {
        const transport = new ConsoleTransport({ minLevel: LogLevel.Info, formatter });
        await expect(transport.flush()).resolves.toBeUndefined();
        expect(streams).toHaveLength(0);

        await transport.write(entry(LogLevel.Info));
        await transport.flush();

        expect(streams[0].flush).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should write each entry with console.log when buffered is false', async () => {
        const transport = new ConsoleTransport({ minLevel: LogLevel.Info, formatter, buffered: false });

        await transport.write(entry(LogLevel.Warn));
        await transport.write(entry(LogLevel.Trace));

        expect(console.log).toHaveBeenCalledTimes(1);
        expect(console.log).toHaveBeenCalledWith('formatted message');
        expect(streams).toHaveLength(0);
    });
});
