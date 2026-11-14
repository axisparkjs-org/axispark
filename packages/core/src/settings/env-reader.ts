/**
 * Options of `EnvReader.string()`.
 */
export interface EnvStringOptions {
    /** Value used when the variable is not defined or is empty. Without it, the variable is required. */
    default?: string;
    /** Minimum number of characters of the value. */
    minLength?: number;
    /** Regular expression that the value must match. */
    pattern?: RegExp;
}

/**
 * Options of `EnvReader.int()` and `EnvReader.float()`.
 */
export interface EnvNumberOptions {
    /** Value used when the variable is not defined or is empty. Without it, the variable is required. */
    default?: number;
    /** Minimum allowed value (inclusive). */
    min?: number;
    /** Maximum allowed value (inclusive). */
    max?: number;
}

/**
 * Options of `EnvReader.url()`.
 */
export interface EnvUrlOptions {
    /** Value used when the variable is not defined or is empty. Without it, the variable is required. */
    default?: string;
    /** Allowed protocols, without the trailing colon (for example `['http', 'https']`). By default, any protocol is accepted. */
    protocols?: string[];
}

/**
 * Options of `EnvReader.list()`.
 */
export interface EnvListOptions {
    /** Value used when the variable is not defined or is empty. Without it, the variable is required. */
    default?: string[];
    /** Separator of the items. Defaults to `,`. */
    separator?: string;
}

const TRUE_VALUES = ['true', '1', 'yes', 'on'];
const FALSE_VALUES = ['false', '0', 'no', 'off'];
const INTEGER = /^[+-]?\d+$/;
const FLOAT = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;
const MAX_RECEIVED_LENGTH = 40;

/**
 * Reads the variables of the environment for `SettingsOptions.load`. Each method converts and validates one variable, and records an error instead of throwing, so every problem is reported at once with an `InvalidSettingsError` after `load()` returns.
 *
 * A variable without a default is required. A variable defined with an empty value is treated as not defined.
 *
 * ```typescript
 * load: (env) => ({
 *     port: env.int('PORT', 3000),
 *     databaseUrl: env.url('DATABASE_URL'),
 *     sessionSecret: env.string('SESSION_SECRET', { minLength: 32 }),
 *     cacheStore: env.enum('CACHE_STORE', ['memory', 'redis'], 'memory')
 * })
 * ```
 */
export class EnvReader {
    private readonly problems: string[] = [];

    /**
     * Creates a new reader.
     * @param variables The variables to read, usually the `.env` files combined with `process.env`.
     */
    public constructor(private readonly variables: Readonly<Record<string, string | undefined>>) {}

    /**
     * The problems recorded by the methods of the reader, in the order they were found.
     */
    public get errors(): readonly string[] {
        return [...this.problems];
    }

    /**
     * Reads a string.
     * @param name The name of the variable.
     * @param defaultOrOptions The default value, or the options of the variable (`default`, `minLength` and `pattern`).
     * @returns The value of the variable, or its default.
     */
    public string(name: string, defaultOrOptions?: string | EnvStringOptions): string {
        const options: EnvStringOptions = typeof defaultOrOptions === 'string' ? { default: defaultOrOptions } : (defaultOrOptions ?? {});
        const value = this.read(name, options.default);
        if (value === undefined) return options.default as string;

        if (options.minLength !== undefined && value.length < options.minLength) {
            this.problems.push(`${name} must have at least ${options.minLength} characters`);
        }
        if (options.pattern && !new RegExp(options.pattern.source, options.pattern.flags.replace(/[gy]/g, '')).test(value)) {
            this.problems.push(`${name} must match the pattern ${options.pattern}`);
        }

        return value;
    }

    /**
     * Reads an integer.
     * @param name The name of the variable.
     * @param defaultOrOptions The default value, or the options of the variable (`default`, `min` and `max`).
     * @returns The value of the variable, or its default.
     */
    public int(name: string, defaultOrOptions?: number | EnvNumberOptions): number {
        return this.number(name, defaultOrOptions, INTEGER, 'an integer');
    }

    /**
     * Reads a number, with or without decimals.
     * @param name The name of the variable.
     * @param defaultOrOptions The default value, or the options of the variable (`default`, `min` and `max`).
     * @returns The value of the variable, or its default.
     */
    public float(name: string, defaultOrOptions?: number | EnvNumberOptions): number {
        return this.number(name, defaultOrOptions, FLOAT, 'a number');
    }

    /**
     * Reads a boolean. `true`, `1`, `yes` and `on` are read as `true`, and `false`, `0`, `no` and `off` as `false`, ignoring the case.
     * @param name The name of the variable.
     * @param defaultValue The default value. Without it, the variable is required.
     * @returns The value of the variable, or its default.
     */
    public boolean(name: string, defaultValue?: boolean): boolean {
        const value = this.read(name, defaultValue);
        if (value === undefined) return defaultValue as boolean;

        const normalized = value.trim().toLowerCase();
        if (TRUE_VALUES.includes(normalized)) return true;
        if (FALSE_VALUES.includes(normalized)) return false;

        this.problems.push(`${name} must be a boolean (${[...TRUE_VALUES, ...FALSE_VALUES].join(', ')}) (received ${this.received(value)})`);
        return defaultValue as boolean;
    }

    /**
     * Reads one of a set of allowed values.
     * @param name The name of the variable.
     * @param values The allowed values.
     * @param defaultValue The default value. Without it, the variable is required.
     * @returns The value of the variable, or its default.
     */
    public enum<const V extends readonly string[]>(name: string, values: V, defaultValue?: V[number]): V[number] {
        const value = this.read(name, defaultValue);
        if (value === undefined) return defaultValue as V[number];

        if (!values.includes(value)) {
            this.problems.push(`${name} must be one of ${values.join(', ')} (received ${this.received(value)})`);
            return defaultValue as V[number];
        }

        return value;
    }

    /**
     * Reads an absolute URL. The value is returned as it is defined, as a string.
     * @param name The name of the variable.
     * @param defaultOrOptions The default value, or the options of the variable (`default` and `protocols`).
     * @returns The value of the variable, or its default.
     */
    public url(name: string, defaultOrOptions?: string | EnvUrlOptions): string {
        const options: EnvUrlOptions = typeof defaultOrOptions === 'string' ? { default: defaultOrOptions } : (defaultOrOptions ?? {});
        const value = this.read(name, options.default);
        if (value === undefined) return options.default as string;

        if (!URL.canParse(value)) {
            this.problems.push(`${name} must be a valid URL`);
            return value;
        }

        const protocol = new URL(value).protocol.slice(0, -1);
        if (options.protocols && !options.protocols.includes(protocol)) {
            this.problems.push(`${name} must use one of the protocols ${options.protocols.join(', ')} (received ${this.received(protocol)})`);
        }

        return value;
    }

    /**
     * Reads a JSON value.
     * @param name The name of the variable.
     * @param defaultValue The default value. Without it, the variable is required.
     * @returns The parsed value of the variable, or its default.
     */
    public json<T = unknown>(name: string, defaultValue?: T): T {
        const value = this.read(name, defaultValue);
        if (value === undefined) return defaultValue as T;

        try {
            return JSON.parse(value) as T;
        } catch {
            this.problems.push(`${name} must be valid JSON`);
            return defaultValue as T;
        }
    }

    /**
     * Reads a list of strings separated by commas (or by `separator`). The items are trimmed and the empty items are removed.
     * @param name The name of the variable.
     * @param defaultOrOptions The default value, or the options of the variable (`default` and `separator`).
     * @returns The items of the variable, or its default.
     */
    public list(name: string, defaultOrOptions?: string[] | EnvListOptions): string[] {
        const options: EnvListOptions = Array.isArray(defaultOrOptions) ? { default: defaultOrOptions } : (defaultOrOptions ?? {});
        const value = this.read(name, options.default);
        if (value === undefined) return options.default as string[];

        return value
            .split(options.separator ?? ',')
            .map((item) => item.trim())
            .filter((item) => item !== '');
    }

    private number(name: string, defaultOrOptions: number | EnvNumberOptions | undefined, format: RegExp, kind: string): number {
        const options: EnvNumberOptions = typeof defaultOrOptions === 'number' ? { default: defaultOrOptions } : (defaultOrOptions ?? {});
        const value = this.read(name, options.default);
        if (value === undefined) return options.default as number;

        const trimmed = value.trim();
        const parsed = Number(trimmed);
        if (!format.test(trimmed) || !Number.isFinite(parsed)) {
            this.problems.push(`${name} must be ${kind} (received ${this.received(value)})`);
            return options.default as number;
        }

        if (options.min !== undefined && parsed < options.min) {
            this.problems.push(`${name} must be at least ${options.min} (received ${this.received(value)})`);
        }
        if (options.max !== undefined && parsed > options.max) {
            this.problems.push(`${name} must be at most ${options.max} (received ${this.received(value)})`);
        }

        return parsed;
    }

    // Shows a received value in the errors, truncated so long values are not printed in full.
    private received(value: string): string {
        const shown = value.length > MAX_RECEIVED_LENGTH ? `${value.slice(0, MAX_RECEIVED_LENGTH)}…` : value;
        return JSON.stringify(shown);
    }

    private read(name: string, defaultValue: unknown): string | undefined {
        const value = this.variables[name];
        if (value !== undefined && value !== '') return value;

        if (defaultValue === undefined) this.problems.push(`${name} is required`);
        return undefined;
    }
}
