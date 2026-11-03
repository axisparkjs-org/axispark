import { SimpleFormatter } from './simple-formatter';
import { LogEntry } from '../log-entry';
import { LogLevel } from '../log-level';

describe('SimpleFormatter', () => {
    let formatter: SimpleFormatter;

    beforeEach(() => {
        formatter = new SimpleFormatter();
    });

    it('should create an instance of SimpleFormatter', () => {
        expect(formatter).toBeInstanceOf(SimpleFormatter);
    });

    it('should format a log entry without scopes', () => {
        const entry: LogEntry = {
            timestamp: new Date('2025-01-01T10:00:00.000Z'),
            level: LogLevel.Info,
            message: 'Application started',
            scopes: []
        };

        const result = formatter.format(entry);

        expect(result).toBe('[2025-01-01T10:00:00.000Z] INFO Application started');
    });

    it('should format a log entry with one scope', () => {
        const entry: LogEntry = {
            timestamp: new Date('2025-01-01T10:00:00.000Z'),
            level: LogLevel.Warn,
            message: 'Low memory',
            scopes: ['Server']
        };

        const result = formatter.format(entry);

        expect(result).toBe('[2025-01-01T10:00:00.000Z] WARN [Server] Low memory');
    });

    it('should format a log entry with multiple scopes', () => {
        const entry: LogEntry = {
            timestamp: new Date('2025-01-01T10:00:00.000Z'),
            level: LogLevel.Error,
            message: 'Unexpected error',
            scopes: ['API', 'Users', 'Controller']
        };

        const result = formatter.format(entry);

        expect(result).toBe('[2025-01-01T10:00:00.000Z] ERROR [API > Users > Controller] Unexpected error');
    });

    it('should preserve the original log entry', () => {
        const error = new Error('Test error');
        error.stack = 'Error: Test error';

        const entry: LogEntry = {
            timestamp: new Date('2025-01-01T10:00:00.000Z'),
            level: LogLevel.Info,
            message: 'Test',
            scopes: ['Scope'],
            error
        };

        const original = {
            ...entry,
            timestamp: new Date(entry.timestamp)
        };

        formatter.format(entry);

        expect(entry).toEqual(original);
    });

    it('should format a log entry with an error stack', () => {
        const error = new Error('Something went wrong');
        error.stack = 'Error: Something went wrong\n    at test.ts:1:1';

        const entry: LogEntry = {
            timestamp: new Date('2025-01-01T10:00:00.000Z'),
            level: LogLevel.Error,
            message: 'Unexpected error',
            scopes: [],
            error
        };

        const result = formatter.format(entry);

        expect(result).toBe(`[2025-01-01T10:00:00.000Z] ERROR Unexpected error\n${error.stack}`);
    });

    it('should format a log entry with an error message when stack is not available', () => {
        const error = new Error('Something went wrong');
        error.stack = undefined;

        const entry: LogEntry = {
            timestamp: new Date('2025-01-01T10:00:00.000Z'),
            level: LogLevel.Error,
            message: 'Unexpected error',
            scopes: [],
            error
        };

        const result = formatter.format(entry);

        expect(result).toBe('[2025-01-01T10:00:00.000Z] ERROR Unexpected error\nSomething went wrong');
    });

    it('should append the metadata as JSON after the message', () => {
        const entry: LogEntry = {
            timestamp: new Date('2025-01-01T10:00:00.000Z'),
            level: LogLevel.Info,
            message: 'Request completed',
            scopes: ['HttpPlugin'],
            metadata: { method: 'GET', status: 200 },
            error: { name: 'Error', message: 'Boom' } as Error
        };

        expect(formatter.format(entry)).toBe('[2025-01-01T10:00:00.000Z] INFO [HttpPlugin] Request completed {"method":"GET","status":200}\nBoom');
    });

    it('should not print empty metadata', () => {
        const entry: LogEntry = {
            timestamp: new Date('2025-01-01T10:00:00.000Z'),
            level: LogLevel.Info,
            message: 'Application started',
            scopes: [],
            metadata: {}
        };

        expect(formatter.format(entry)).toBe('[2025-01-01T10:00:00.000Z] INFO Application started');
    });
});
