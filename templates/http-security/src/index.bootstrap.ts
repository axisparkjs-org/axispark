import { app } from './app';

const bootstrap = async () => {
    try {
        await app.init();
        await app.run();
    } catch (error) {
        console.error('Error during bootstrap:', error);
        throw error; // Rethrow the error to ensure the process exits with a non-zero status code
    } finally {
        await app.destroy();
    }
};

bootstrap().catch(() => {
    process.exit(1);
});
