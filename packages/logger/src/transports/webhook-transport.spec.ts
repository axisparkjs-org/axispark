import { WebhookTransport } from './webhook-transport';
import { LogEntry } from '../log-entry';
import { LogFormatter } from '../log-formatter';
import { LogLevel } from '../log-level';

describe('WebhookTransport', () => {
    let formatter: jest.Mocked<LogFormatter>;
    let transport: WebhookTransport;

    const createEntry = (level: LogLevel): LogEntry => ({
        timestamp: new Date(),
        level,
        message: 'Test',
        scopes: []
    });

    beforeEach(() => {
        formatter = {
            format: jest.fn().mockReturnValue('formatted')
        };

        transport = new WebhookTransport({
            url: 'https://discord.com/api/webhooks/test',
            formatter,
            minLevel: LogLevel.Info
        });

        global.fetch = jest.fn().mockResolvedValue({} as Response);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should send formatted message to webhook', async () => {
        const entry = createEntry(LogLevel.Info);

        await transport.write(entry);

        expect(formatter.format).toHaveBeenCalledWith(entry);

        expect(fetch).toHaveBeenCalledWith('https://discord.com/api/webhooks/test', {
            method: 'POST',
            signal: expect.any(AbortSignal),
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: 'formatted'
            })
        });
    });

    it('should abort the request after 5 seconds by default, or after the configured timeout', async () => {
        const timeout = jest.spyOn(AbortSignal, 'timeout');

        await transport.write(createEntry(LogLevel.Info));
        await new WebhookTransport({ url: 'https://discord.com/api/webhooks/test', formatter, minLevel: LogLevel.Info, timeout: 100 }).write(
            createEntry(LogLevel.Info)
        );

        expect(timeout).toHaveBeenNthCalledWith(1, 5000);
        expect(timeout).toHaveBeenNthCalledWith(2, 100);
    });

    it('should not send logs below minLevel', async () => {
        await transport.write(createEntry(LogLevel.Debug));

        expect(formatter.format).not.toHaveBeenCalled();
        expect(fetch).not.toHaveBeenCalled();
    });
});
