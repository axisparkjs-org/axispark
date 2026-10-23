import { app } from './app-fastify';

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
