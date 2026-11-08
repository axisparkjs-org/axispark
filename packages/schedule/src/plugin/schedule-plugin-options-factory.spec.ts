import { SchedulePlugin } from './schedule-plugin';
import { SchedulePluginOptionsFactory } from './schedule-plugin-options-factory';

describe('SchedulePluginOptionsFactory', () => {
    it('creates the options of the schedule plugin', () => {
        expect(SchedulePluginOptionsFactory.create()).toEqual({ plugin: SchedulePlugin, shutdownTimeout: 25_000 });
    });

    it('keeps the configured lock store', () => {
        const lockStore = jest.fn();

        expect(SchedulePluginOptionsFactory.create({ lockStore })).toEqual({ plugin: SchedulePlugin, shutdownTimeout: 25_000, lockStore });
    });

    it('keeps the configured shutdown timeout', () => {
        expect(SchedulePluginOptionsFactory.create({ shutdownTimeout: 0 })).toEqual({ plugin: SchedulePlugin, shutdownTimeout: 0 });
    });
});
