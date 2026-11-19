import { EnvReader } from '@axisparkjs/core';

/**
 * Builds the settings of the application from the environment variables and the `.env` file. See `.env.example`.
 */
export const loadSettings = (env: EnvReader) => ({
    greeting: env.string('GREETING', 'Hello from AxiSpark.js')
});

export type AppSettings = ReturnType<typeof loadSettings>;
