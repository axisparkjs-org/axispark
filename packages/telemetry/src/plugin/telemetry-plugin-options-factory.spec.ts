import { TelemetryPlugin } from './telemetry-plugin';
import { TelemetryPluginOptionsFactory } from './telemetry-plugin-options-factory';

describe('TelemetryPluginOptionsFactory', () => {
    it('enables the traces and the metrics by default', () => {
        expect(TelemetryPluginOptionsFactory.create()).toEqual({ plugin: TelemetryPlugin, traces: true, metrics: true });
    });

    it('overrides the defaults', () => {
        const ignore = () => true;

        expect(TelemetryPluginOptionsFactory.create({ metrics: false, ignore })).toEqual({ plugin: TelemetryPlugin, traces: true, metrics: false, ignore });
    });
});
