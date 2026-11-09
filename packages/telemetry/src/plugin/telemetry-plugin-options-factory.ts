import { Factory } from '@axisparkjs/common';
import { TelemetryPluginOptions } from './telemetry-plugin-options';
import { TelemetryPlugin } from './telemetry-plugin';

/**
 * A factory for creating TelemetryPluginOptions instances, with every signal enabled by default.
 */
export class TelemetryPluginOptionsFactoryStatic implements Factory<TelemetryPluginOptions> {
    create(options?: Omit<TelemetryPluginOptions, 'plugin'>): TelemetryPluginOptions {
        return {
            plugin: TelemetryPlugin,
            traces: true,
            metrics: true,
            ...options
        };
    }
}

/**
 * A factory for creating TelemetryPluginOptions instances.
 */
export const TelemetryPluginOptionsFactory = new TelemetryPluginOptionsFactoryStatic();
