import { TestTelemetry } from '../../test/otel';
import { StoreTelemetry } from './store-telemetry';

describe('StoreTelemetry', () => {
    let telemetry: TestTelemetry;

    beforeEach(() => {
        telemetry = new TestTelemetry().register();
    });

    afterEach(async () => {
        await telemetry.shutdown();
    });

    it('records the duration of the operations with their kind, name and error', async () => {
        const instrumentation = new StoreTelemetry(telemetry.meter());

        instrumentation.start({ kind: 'lock', operation: 'acquire' })();
        instrumentation.start({ kind: 'rate-limit', operation: 'consume' })(new RangeError('down'));
        instrumentation.start({ kind: 'cache', operation: 'get' })('not an error');

        expect((await telemetry.dataPoints('axispark.store.operation.duration')).map((point) => point.attributes)).toEqual([
            { 'axispark.store.kind': 'lock', 'axispark.store.operation': 'acquire' },
            { 'axispark.store.kind': 'rate-limit', 'axispark.store.operation': 'consume', 'error.type': 'RangeError' },
            { 'axispark.store.kind': 'cache', 'axispark.store.operation': 'get', 'error.type': '_OTHER' }
        ]);
    });
});
