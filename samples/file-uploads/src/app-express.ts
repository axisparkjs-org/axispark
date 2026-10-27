import { AxiSparkFactory } from '@axisparkjs/core';
import { HttpPlugin } from '@axisparkjs/http';
import { HttpPluginOptionsFactory } from '@axisparkjs/http-express';
import { ConsoleTransport, LogLevel, SimpleFormatter } from '@axisparkjs/logger';

export const app = AxiSparkFactory.create({
    name: 'File Uploads',
    basePath: __dirname,
    logTransports: [
        new ConsoleTransport({
            minLevel: LogLevel.Debug,
            formatter: new SimpleFormatter()
        })
    ]
});
app.use(
    HttpPlugin,
    HttpPluginOptionsFactory.create({
        basePath: '/api',
        port: 0,
        fileUpload: true,
        fileUploadOptions: {
            maxFileSize: 1024,
            maxFiles: 3,
            allowedMimeTypes: ['text/plain', 'application/pdf'],
            message: (limit, reason) => `Upload rejected (${reason}): limit is ${limit}`
        }
    })
);
