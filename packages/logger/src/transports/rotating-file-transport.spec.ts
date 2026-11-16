import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import * as fsPromises from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { LogEntry } from '../log-entry';
import { LogFormatter } from '../log-formatter';
import { LogLevel } from '../log-level';
import { RotatingFileTransport } from './rotating-file-transport';

jest.mock('node:fs/promises', () => {
    const actual = jest.requireActual('node:fs/promises');
    return { ...actual, stat: jest.fn(actual.stat), rename: jest.fn(actual.rename) };
});

describe('RotatingFileTransport', () => {
    let dir: string;
    let file: string;
    let formatter: jest.Mocked<LogFormatter>;
    let transport: RotatingFileTransport;

    const createEntry = (message: string, level = LogLevel.Info): LogEntry => ({ timestamp: new Date(), level, message, scopes: [] });
    const create = (maxSize: number, maxFiles = 3) => new RotatingFileTransport({ file, formatter, minLevel: LogLevel.Info, maxSize, maxFiles });

    beforeEach(async () => {
        dir = await mkdtemp(path.join(os.tmpdir(), 'axispark-rotating-transport-'));
        file = path.join(dir, 'app.log');
        formatter = { format: jest.fn((entry: LogEntry) => entry.message) };
        transport = create(10);
        (fsPromises.stat as jest.Mock).mockClear();
    });

    afterEach(async () => {
        await transport.flush();
        jest.restoreAllMocks();
        await rm(dir, { recursive: true, force: true });
    });

    it('should write without rotating while the file is below maxSize', async () => {
        await transport.write(createEntry('1234'));
        await transport.write(createEntry('5678'));

        expect(await readdir(dir)).toEqual(['app.log']);
        expect(await readFile(file, 'utf8')).toBe('1234\n5678\n');
    });

    it('should rotate the file when it reaches maxSize, counting the size in memory', async () => {
        const stat = fsPromises.stat as jest.Mock;

        for (const message of ['aaaa', 'bbbb', 'cccc', 'dddd', 'eeee']) await transport.write(createEntry(message));
        await transport.flush();

        expect(await readFile(path.join(dir, 'app.2.log'), 'utf8')).toBe('aaaa\nbbbb\n');
        expect(await readFile(path.join(dir, 'app.1.log'), 'utf8')).toBe('cccc\ndddd\n');
        expect(await readFile(file, 'utf8')).toBe('eeee\n');
        expect(stat).toHaveBeenCalledTimes(1);
    });

    it('should read the size of an existing file once', async () => {
        await writeFile(file, '0123456789');

        await transport.write(createEntry('new'));
        await transport.flush();

        expect(await readFile(path.join(dir, 'app.1.log'), 'utf8')).toBe('0123456789');
        expect(await readFile(file, 'utf8')).toBe('new\n');
    });

    it('should keep at most maxFiles rotated files', async () => {
        transport = create(1, 2);

        for (const message of ['a', 'b', 'c', 'd']) await transport.write(createEntry(message));
        await transport.flush();

        expect((await readdir(dir)).sort()).toEqual(['app.1.log', 'app.2.log', 'app.log']);
        expect(await readFile(path.join(dir, 'app.2.log'), 'utf8')).toBe('b\n');
        expect(await readFile(file, 'utf8')).toBe('d\n');
    });

    it('should ignore rename errors', async () => {
        (fsPromises.rename as jest.Mock).mockRejectedValueOnce(new Error('busy')).mockRejectedValueOnce(new Error('busy'));
        transport = create(1);

        await transport.write(createEntry('a'));
        await expect(transport.write(createEntry('b'))).resolves.toBeUndefined();
    });

    it('should not write when level is below minLevel', async () => {
        await transport.write(createEntry('debug', LogLevel.Debug));

        expect(formatter.format).not.toHaveBeenCalled();
        expect(await readdir(dir)).toEqual([]);
    });
});
