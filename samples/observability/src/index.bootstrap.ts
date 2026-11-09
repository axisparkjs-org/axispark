// The SDK must start before the application, so the tracer and the meter of the TelemetryPlugin export to it.
import { sdk } from './instrumentation.bootstrap';
import { createApp } from './app';

const app = createApp(Number(process.env.PORT ?? 3000));

const bootstrap = async () => {
    try {
        await app.init();
        await app.run();
    } finally {
        await app.destroy();
        await sdk.shutdown();
    }
};

bootstrap().catch(() => {
    process.exit(1);
});
