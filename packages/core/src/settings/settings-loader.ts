import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { EnvReader } from './env-reader';
import { InvalidSettingsError } from './invalid-settings-error';
import { SettingsOptions } from './settings-options';
import { DeepReadonly } from './deep-readonly';

/**
 * Loads the application settings: reads the `.env` files, combines them with the environment variables, runs the `load` function and validates the result. The returned object is deeply frozen.
 *
 * ```typescript
 * const settings = new SettingsLoader().load({ envFiles: ['.env'], load: (env) => ({ port: env.int('PORT', 3000) }) });
 * ```
 */
export class SettingsLoader {
    /**
     * Creates a new loader.
     * @param environment The environment variables, which win over the values of the files. Defaults to `process.env`.
     * @param cwd The directory the `.env` files are relative to. Defaults to `process.cwd()`.
     */
    public constructor(
        private readonly environment: NodeJS.ProcessEnv = process.env,
        private readonly cwd: string = process.cwd()
    ) {}

    /**
     * Loads the settings.
     * @param options The settings options of the application.
     * @returns The deeply frozen settings object.
     * @throws InvalidSettingsError when a variable is missing or invalid.
     */
    public load<T extends object>(options: SettingsOptions<T>): DeepReadonly<T> {
        const reader = new EnvReader({ ...this.readEnvFiles(options.envFiles ?? []), ...this.definedVariables() });
        const settings = options.load(reader);

        if (reader.errors.length > 0) throw new InvalidSettingsError(reader.errors);

        return this.freeze(settings);
    }

    /**
     * Freezes an object, and its nested objects and arrays.
     * @param value The value to freeze.
     * @returns The same value, frozen.
     */
    public freeze<T>(value: T): DeepReadonly<T> {
        if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
            Object.freeze(value);
            for (const key of Reflect.ownKeys(value)) this.freeze((value as Record<PropertyKey, unknown>)[key]);
        }
        return value as DeepReadonly<T>;
    }

    private readEnvFiles(files: string[]): Record<string, string> {
        const variables: Record<string, string> = {};
        for (const file of files) {
            let content: string;
            try {
                content = readFileSync(resolve(this.cwd, file), 'utf8');
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
                throw error;
            }

            for (const [name, value] of Object.entries(parseEnv(content))) {
                if (!(name in variables) && value !== undefined) variables[name] = value;
            }
        }
        return variables;
    }

    private definedVariables(): Record<string, string> {
        return Object.fromEntries(Object.entries(this.environment).filter((entry): entry is [string, string] => entry[1] !== undefined));
    }
}
