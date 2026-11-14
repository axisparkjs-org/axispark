import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { EnvReader } from './env-reader';
import { InvalidSettingsError } from './invalid-settings-error';
import { SettingsOptions } from './settings-options';
import { DeepReadonly } from './deep-readonly';

/**
 * Loads the application settings: reads the `.env` files, combines them with the environment variables, runs the `load` function and validates the result. The returned object is deeply frozen.
 * @param options The settings options of the application.
 * @param environment The environment variables, which win over the values of the files. Defaults to `process.env`.
 * @param cwd The directory the `.env` files are relative to. Defaults to `process.cwd()`.
 * @returns The deeply frozen settings object.
 * @throws InvalidSettingsError when a variable is missing or invalid.
 */
export function loadSettings<T extends object>(
    options: SettingsOptions<T>,
    environment: NodeJS.ProcessEnv = process.env,
    cwd = process.cwd()
): DeepReadonly<T> {
    const reader = new EnvReader({ ...readEnvFiles(options.envFiles ?? [], cwd), ...definedVariables(environment) });
    const settings = options.load(reader);

    if (reader.errors.length > 0) throw new InvalidSettingsError(reader.errors);

    return deepFreeze(settings);
}

/**
 * Freezes an object, and its nested objects and arrays.
 * @param value The value to freeze.
 * @returns The same value, frozen.
 */
export function deepFreeze<T>(value: T): DeepReadonly<T> {
    if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const key of Reflect.ownKeys(value)) deepFreeze((value as Record<PropertyKey, unknown>)[key]);
    }
    return value as DeepReadonly<T>;
}

function readEnvFiles(files: string[], cwd: string): Record<string, string> {
    const variables: Record<string, string> = {};
    for (const file of files) {
        let content: string;
        try {
            content = readFileSync(resolve(cwd, file), 'utf8');
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

function definedVariables(environment: NodeJS.ProcessEnv): Record<string, string> {
    return Object.fromEntries(Object.entries(environment).filter((entry): entry is [string, string] => entry[1] !== undefined));
}
