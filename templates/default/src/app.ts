import { AxiSparkFactory } from '@axisparkjs/core';
import { ConsoleTransport, LogLevel, SimpleFormatter } from '@axisparkjs/logger';
import { HelloWorldPlugin } from './plugin';
import { loadSettings } from './settings';

export const app = AxiSparkFactory.create({
    name: 'Hello World App',
    basePath: __dirname,
    settings: {
        envFiles: ['.env'],
        load: loadSettings
    },
    logTransports: [
        new ConsoleTransport({
            minLevel: LogLevel.Info,
            formatter: new SimpleFormatter()
        })
    ]
});
app.use(HelloWorldPlugin);
