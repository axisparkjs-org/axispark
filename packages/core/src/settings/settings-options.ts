import { EnvReader } from './env-reader';

/**
 * Options of the application settings, given in the `settings` option of `AxiSparkFactory.create()`.
 *
 * ```typescript
 * export const app = AxiSparkFactory.create({
 *     name: 'Orders',
 *     basePath: __dirname,
 *     settings: {
 *         envFiles: ['.env'],
 *         load: (env) => ({
 *             port: env.int('PORT', 3000),
 *             databaseUrl: env.string('DATABASE_URL')
 *         })
 *     }
 * });
 * ```
 */
export interface SettingsOptions<T extends object = object> {
    /**
     * `.env` files to load, relative to the working directory. The files are parsed with `util.parseEnv()` of Node.js. A variable defined in a file is not replaced by the later files, and the real environment variables always win over the values of the files. Missing files are ignored.
     */
    envFiles?: string[];

    /**
     * Builds the settings object. It runs once, synchronously, when the application is created. The variables read with the `env` reader are converted and validated, and an `InvalidSettingsError` listing every problem is thrown after it returns.
     */
    load: (env: EnvReader) => T;
}
