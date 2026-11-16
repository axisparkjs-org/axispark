import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DailyFileTransport } from './daily-file-transport';
import { LogLevel } from '../log-level';
import { LogEntry } from '../log-entry';

describe('DailyFileTransport', () => {
    let dir: string;

    const createEntry = (message: string): LogEntry => ({ timestamp: new Date(), level: LogLevel.Info, message, scopes: [] });

    beforeEach(async () => {
        dir = await mkdtemp(path.join(os.tmpdir(), 'axispark-daily-transport-'));
        jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] });
        jest.setSystemTime(new Date('2026-07-28T10:00:00Z'));
    });

    afterEach(async () => {
        jest.useRealTimers();
        await rm(dir, { recursive: true, force: true });
    });

    it('should write into the file of the day and switch to a new file the next day', async () => {
        const transport = new DailyFileTransport({
            file: path.join(dir, 'app.log'),
            formatter: { format: (entry: LogEntry) => entry.message },
            minLevel: LogLevel.Info
        });

        await transport.write(createEntry('first'));
        jest.setSystemTime(new Date('2026-07-29T00:00:01Z'));
        await transport.write(createEntry('second'));
        await transport.flush();

        expect(await readFile(path.join(dir, 'app-2026-07-28.log'), 'utf8')).toBe('first\n');
        expect(await readFile(path.join(dir, 'app-2026-07-29.log'), 'utf8')).toBe('second\n');
    });
});
