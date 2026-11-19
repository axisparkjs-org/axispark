import { createApp } from './app';

const app = createApp('express', 3000);

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
