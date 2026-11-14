import { AxiSparkFactory } from '@axisparkjs/core';
import { ConsoleTransport, LogLevel, SimpleFormatter } from '@axisparkjs/logger';
import { SchedulePlugin } from '@axisparkjs/schedule';
import { loadSettings } from './settings';

export const app = AxiSparkFactory.create({
    name: 'Scheduler Template',
    basePath: __dirname,
    settings: {
        envFiles: ['.env'],
        load: loadSettings
    },
    logTransports: [
        new ConsoleTransport({
            minLevel: LogLevel.Debug,
            formatter: new SimpleFormatter()
        })
    ]
});
app.use(SchedulePlugin);
