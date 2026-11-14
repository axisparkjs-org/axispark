import { createApp } from './app';

// PORT, CACHE_STORE and REDIS_URL are read from the environment or from the .env file (see .env.example).
const app = createApp();

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
