import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as fs from 'node:fs';
import { FileTransport } from './file-transport';
import { LogFormatter } from '../log-formatter';
import { LogLevel } from '../log-level';
import { LogEntry } from '../log-entry';

jest.mock('node:fs', () => {
    const actual = jest.requireActual('node:fs');
    return { ...actual, createWriteStream: jest.fn(actual.createWriteStream) };
});

describe('FileTransport', () => {
    let dir: string;
    let file: string;
    let formatter: jest.Mocked<LogFormatter>;
    let transport: FileTransport;

    const createEntry = (level: LogLevel, message = 'Test'): LogEntry => ({ timestamp: new Date(), level, message, scopes: [] });

    beforeEach(async () => {
        dir = await mkdtemp(path.join(os.tmpdir(), 'axispark-file-transport-'));
        file = path.join(dir, 'app.log');
        formatter = { format: jest.fn((entry: LogEntry) => entry.message) };
        transport = new FileTransport({ file, formatter, minLevel: LogLevel.Info });
        (fs.createWriteStream as jest.Mock).mockClear();
    });

    afterEach(async () => {
        await transport.flush();
        jest.restoreAllMocks();
        await rm(dir, { recursive: true, force: true });
    });

    it('should append the formatted entries in order with one stream', async () => {
        const open = fs.createWriteStream as jest.Mock;

        await Promise.all(['one', 'two', 'three'].map((message) => transport.write(createEntry(LogLevel.Info, message))));
        await transport.write(createEntry(LogLevel.Error, 'four'));

        expect(await readFile(file, 'utf8')).toBe('one\ntwo\nthree\nfour\n');
        expect(open).toHaveBeenCalledTimes(1);
        expect(open).toHaveBeenCalledWith(file, { flags: 'a' });
    });

    it('should ignore entries below minLevel', async () => {
        await transport.write(createEntry(LogLevel.Debug));

        expect(formatter.format).not.toHaveBeenCalled();
        await expect(readFile(file, 'utf8')).rejects.toThrow();
    });

    it('should keep the content of an existing file', async () => {
        await transport.write(createEntry(LogLevel.Info, 'first'));
        await transport.flush();

        await new FileTransport({ file, formatter, minLevel: LogLevel.Info }).write(createEntry(LogLevel.Info, 'second'));

        expect(await readFile(file, 'utf8')).toBe('first\nsecond\n');
    });

    it('should close the file in flush and open it again for the next entry', async () => {
        const open = fs.createWriteStream as jest.Mock;
        await transport.write(createEntry(LogLevel.Info, 'before'));

        await transport.flush();
        await transport.flush();
        await transport.write(createEntry(LogLevel.Info, 'after'));

        expect(open).toHaveBeenCalledTimes(2);
        expect(await readFile(file, 'utf8')).toBe('before\nafter\n');
    });

    it('should reject when the file can not be written, and open it again for the next entry', async () => {
        const missing = new FileTransport({ file: path.join(dir, 'missing', 'app.log'), formatter, minLevel: LogLevel.Info });

        await expect(missing.write(createEntry(LogLevel.Info))).rejects.toMatchObject({ code: 'ENOENT' });
        await expect(missing.write(createEntry(LogLevel.Info))).rejects.toMatchObject({ code: 'ENOENT' });
        await expect(missing.flush()).resolves.toBeUndefined();
    });

    it('should switch to the new file when the file of the entries changes', async () => {
        class SwitchingTransport extends FileTransport {
            target = file;
            protected override getFile(): string {
                return this.target;
            }
        }
        const switching = new SwitchingTransport({ file, formatter, minLevel: LogLevel.Info });
        const other = path.join(dir, 'other.log');

        await switching.write(createEntry(LogLevel.Info, 'first'));
        switching.target = other;
        await switching.write(createEntry(LogLevel.Info, 'second'));
        await switching.flush();

        expect(await readFile(file, 'utf8')).toBe('first\n');
        expect(await readFile(other, 'utf8')).toBe('second\n');
    });
});
