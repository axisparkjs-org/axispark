import { EnvReader } from '@axisparkjs/core';

/**
 * Builds the settings of the application from the environment variables and the `.env` file. See `.env.example`.
 */
export const loadSettings = (env: EnvReader) => ({
    port: env.int('PORT', { default: 3000, min: 1, max: 65535 })
});

export type AppSettings = ReturnType<typeof loadSettings>;
