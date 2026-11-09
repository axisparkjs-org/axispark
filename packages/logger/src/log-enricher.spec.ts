import { Logger } from './logger';
import { LogLevel } from './log-level';
import { LogTransport } from './log-transport';

class MockTransport extends LogTransport {
    write = jest.fn();
}

describe('Logger enricher', () => {
    let transport: MockTransport;

    beforeEach(() => {
        transport = new MockTransport({ minLevel: LogLevel.Debug, formatter: { format: jest.fn() } });
    });

    afterEach(() => {
        Logger.registerEnricher();
    });

    it('adds the metadata of the enricher to every entry', async () => {
        Logger.registerEnricher(() => ({ trace_id: 'abc' }));

        await new Logger([transport]).info('message');

        expect(transport.write.mock.calls[0][0].metadata).toEqual({ trace_id: 'abc' });
    });

    it('lets the metadata of the logger and of the entry override the enricher', async () => {
        Logger.registerEnricher(() => ({ trace_id: 'abc', span_id: 'def', user: 'enricher' }));

        await new Logger([transport]).child('Scope', { user: 'child' }).info('message', { span_id: 'entry' });

        expect(transport.write.mock.calls[0][0].metadata).toEqual({ trace_id: 'abc', span_id: 'entry', user: 'child' });
    });

    it('adds nothing when the enricher returns undefined or is removed', async () => {
        Logger.registerEnricher(() => undefined);
        await new Logger([transport]).info('first');
        Logger.registerEnricher();
        await new Logger([transport]).info('second');

        expect(transport.write.mock.calls[0][0].metadata).toBeUndefined();
        expect(transport.write.mock.calls[1][0].metadata).toBeUndefined();
    });
});
