import { AxiSparkFactory } from '@axisparkjs/core';
import { ConsoleTransport, LogLevel, SimpleFormatter } from '@axisparkjs/logger';
import { SchedulePlugin } from '@axisparkjs/schedule';

export const app = AxiSparkFactory.create({
    name: 'Scheduler Template',
    basePath: __dirname,
    logTransports: [
        new ConsoleTransport({
            minLevel: LogLevel.Debug,
            formatter: new SimpleFormatter()
        })
    ]
});
app.use(SchedulePlugin);
