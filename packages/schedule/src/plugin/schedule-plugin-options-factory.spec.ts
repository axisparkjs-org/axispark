import { SchedulePlugin } from './schedule-plugin';
import { SchedulePluginOptionsFactory } from './schedule-plugin-options-factory';

describe('SchedulePluginOptionsFactory', () => {
    it('creates the options of the schedule plugin', () => {
        expect(SchedulePluginOptionsFactory.create()).toEqual({ plugin: SchedulePlugin });
    });

    it('keeps the configured lock store', () => {
        const lockStore = jest.fn();

        expect(SchedulePluginOptionsFactory.create({ lockStore })).toEqual({ plugin: SchedulePlugin, lockStore });
    });
});
