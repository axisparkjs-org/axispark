import { createApp } from './app';

const port = Number(process.env.PORT ?? 3000);
const app = createApp(port);

const bootstrap = async () => {
    try {
        await app.init();
        await app.run();
    } finally {
        await app.destroy();
    }
};

bootstrap().catch(() => {
    process.exit(1);
});
