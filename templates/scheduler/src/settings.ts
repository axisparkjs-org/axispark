import { EnvReader } from '@axisparkjs/core';

/**
 * Builds the settings of the application from the environment variables and the `.env` file. See `.env.example`.
 */
export const loadSettings = (env: EnvReader) => ({
    jobMessage: env.string('JOB_MESSAGE', 'Scheduled job ran')
});

export type AppSettings = ReturnType<typeof loadSettings>;
