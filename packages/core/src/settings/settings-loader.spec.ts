import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deepFreeze, loadSettings } from './settings-loader';
import { InvalidSettingsError } from './invalid-settings-error';

describe('loadSettings', () => {
    let directory: string;

    beforeEach(() => {
        directory = mkdtempSync(join(tmpdir(), 'axispark-settings-'));
    });

    afterEach(() => {
        rmSync(directory, { recursive: true, force: true });
    });

    it('should build the settings from the environment', () => {
        const settings = loadSettings(
            { load: (env) => ({ port: env.int('PORT', 3000), name: env.string('NAME') }) },
            { PORT: '8080', NAME: 'orders' },
            directory
        );
        expect(settings).toEqual({ port: 8080, name: 'orders' });
    });

    it('should read the .env files relative to the working directory', () => {
        writeFileSync(join(directory, '.env'), 'PORT=4000\nNAME="from file"\n# comment\n');
        const settings = loadSettings({ envFiles: ['.env'], load: (env) => ({ port: env.int('PORT'), name: env.string('NAME') }) }, {}, directory);
        expect(settings).toEqual({ port: 4000, name: 'from file' });
    });

    it('should give priority to the real environment over the files', () => {
        writeFileSync(join(directory, '.env'), 'PORT=4000\n');
        const settings = loadSettings({ envFiles: ['.env'], load: (env) => ({ port: env.int('PORT') }) }, { PORT: '5000' }, directory);
        expect(settings.port).toBe(5000);
    });

    it('should not replace the values of the earlier files with the later ones', () => {
        writeFileSync(join(directory, '.env.local'), 'PORT=1111\n');
        writeFileSync(join(directory, '.env'), 'PORT=2222\nHOST=localhost\n');
        const settings = loadSettings(
            { envFiles: ['.env.local', '.env'], load: (env) => ({ port: env.int('PORT'), host: env.string('HOST') }) },
            {},
            directory
        );
        expect(settings).toEqual({ port: 1111, host: 'localhost' });
    });

    it('should ignore missing files', () => {
        const settings = loadSettings({ envFiles: ['.env.missing'], load: (env) => ({ port: env.int('PORT', 3000) }) }, {}, directory);
        expect(settings.port).toBe(3000);
    });

    it('should rethrow the errors that are not missing files', () => {
        mkdirSync(join(directory, '.env'));
        expect(() => loadSettings({ envFiles: ['.env'], load: () => ({}) }, {}, directory)).toThrow();
    });

    it('should use process.env by default', () => {
        process.env.AXISPARK_SETTINGS_TEST = 'from-process';
        try {
            expect(loadSettings({ load: (env) => ({ value: env.string('AXISPARK_SETTINGS_TEST') }) }).value).toBe('from-process');
        } finally {
            delete process.env.AXISPARK_SETTINGS_TEST;
        }
    });

    it('should throw one error that lists every problem', () => {
        const load = () =>
            loadSettings(
                {
                    load: (env) => ({
                        port: env.int('PORT', 3000),
                        databaseUrl: env.string('DATABASE_URL'),
                        sessionSecret: env.string('SESSION_SECRET', { minLength: 32 })
                    })
                },
                { PORT: '30o0', SESSION_SECRET: 'too-short' },
                directory
            );

        expect(load).toThrow(InvalidSettingsError);
        expect(load).toThrow(
            [
                'Invalid application settings:',
                '  - PORT must be an integer (received "30o0")',
                '  - DATABASE_URL is required',
                '  - SESSION_SECRET must have at least 32 characters'
            ].join('\n')
        );
    });

    it('should expose the problems in the error', () => {
        try {
            loadSettings({ load: (env) => ({ url: env.string('DATABASE_URL') }) }, {}, directory);
            fail('Expected an error');
        } catch (error) {
            expect(error).toBeInstanceOf(InvalidSettingsError);
            expect((error as InvalidSettingsError).errors).toEqual(['DATABASE_URL is required']);
            expect((error as InvalidSettingsError).name).toBe('InvalidSettingsError');
        }
    });

    it('should deeply freeze the settings', () => {
        const settings = loadSettings(
            { load: (env) => ({ database: { url: env.string('URL', 'postgres://localhost') }, origins: env.list('ORIGINS', ['a']) }) },
            {},
            directory
        );

        expect(Object.isFrozen(settings)).toBe(true);
        expect(Object.isFrozen(settings.database)).toBe(true);
        expect(Object.isFrozen(settings.origins)).toBe(true);
        expect(() => {
            (settings.database as { url: string }).url = 'other';
        }).toThrow(TypeError);
    });

    it('should freeze primitive values and null without errors', () => {
        expect(deepFreeze(null)).toBeNull();
        expect(deepFreeze(1)).toBe(1);
    });
});
