import { createApp } from './app.fastify';

const app = createApp(process.env.HOST);

const bootstrap = async () => {
    try {
        await app.init();
        await app.run();
    } catch (error) {
        console.error('Error during application bootstrap:', error);
    } finally {
        await app.destroy();
    }
};

bootstrap().catch(() => {
    process.exit(1);
});
