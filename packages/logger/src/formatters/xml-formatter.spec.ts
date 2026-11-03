import { XmlFormatter } from './xml-formatter';
import { LogEntry } from '../log-entry';
import { LogLevel } from '../log-level';

describe('XmlFormatter', () => {
    let formatter: XmlFormatter;

    beforeEach(() => {
        formatter = new XmlFormatter();
    });

    it('should create an instance of XmlFormatter', () => {
        expect(formatter).toBeInstanceOf(XmlFormatter);
    });

    it('should format a basic log entry', () => {
        const entry: LogEntry = {
            timestamp: new Date('2025-01-01T10:00:00.000Z'),
            level: LogLevel.Info,
            message: 'Application started',
            scopes: []
        };

        const result = formatter.format(entry);

        expect(result).toContain('<timestamp>2025-01-01T10:00:00.000Z</timestamp>');
        expect(result).toContain('<level>INFO</level>');
        expect(result).toContain('<message>Application started</message>');
    });

    it('should include scopes, metadata and error', () => {
        const error = new Error('Boom');

        const entry: LogEntry = {
            timestamp: new Date('2025-01-01T10:00:00.000Z'),
            level: LogLevel.Error,
            message: 'Failure',
            scopes: ['API', 'Users'],
            metadata: {
                id: 10
            },
            error
        };

        const result = formatter.format(entry);

        expect(result).toContain('<scope>API</scope>');
        expect(result).toContain('<scope>Users</scope>');
        expect(result).toContain('<metadata><![CDATA[{"id":10}]]></metadata>');
        expect(result).toContain('<name>Error</name>');
        expect(result).toContain('<message>Boom</message>');
    });

    it('should escape xml characters', () => {
        const entry: LogEntry = {
            timestamp: new Date(),
            level: LogLevel.Info,
            message: '<hello> & "world"',
            scopes: ['<scope>']
        };

        const result = formatter.format(entry);

        expect(result).toContain('&lt;hello&gt;');
        expect(result).toContain('&amp;');
        expect(result).toContain('&quot;world&quot;');
        expect(result).toContain('&lt;scope&gt;');
    });

    it('should preserve the original log entry', () => {
        const entry: LogEntry = {
            timestamp: new Date(),
            level: LogLevel.Info,
            message: 'Test',
            scopes: []
        };

        const original = structuredClone({
            ...entry,
            timestamp: new Date(entry.timestamp)
        });

        formatter.format(entry);

        expect(entry).toEqual(original);
    });

    it('should keep the metadata and the stack inside their CDATA sections', () => {
        const error = new Error('Boom');
        error.stack = 'Error: Boom ]]> at line';

        const entry: LogEntry = {
            timestamp: new Date('2025-01-01T10:00:00.000Z'),
            level: LogLevel.Error,
            message: 'Failure',
            scopes: [],
            metadata: { payload: 'a]]>b' },
            error
        };

        const result = formatter.format(entry);

        expect(result).toContain('<metadata><![CDATA[{"payload":"a]]]]><![CDATA[>b"}]]></metadata>');
        expect(result).toContain('<stack><![CDATA[Error: Boom ]]]]><![CDATA[> at line]]></stack>');
    });

    it('should write an empty stack when the error has none', () => {
        const error = new Error('Boom');
        delete error.stack;

        const result = formatter.format({ timestamp: new Date(), level: LogLevel.Error, message: 'Failure', scopes: [], error });

        expect(result).toContain('<stack><![CDATA[]]></stack>');
    });
});
