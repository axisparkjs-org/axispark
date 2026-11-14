import { EnvReader } from './env-reader';

describe('EnvReader', () => {
    const reader = (variables: Record<string, string | undefined>) => new EnvReader(variables);

    describe('string', () => {
        it('should read the value of the variable', () => {
            const env = reader({ NAME: 'orders' });
            expect(env.string('NAME')).toBe('orders');
            expect(env.errors).toEqual([]);
        });

        it('should use the default value when the variable is missing or empty', () => {
            const env = reader({ EMPTY: '' });
            expect(env.string('NAME', 'default')).toBe('default');
            expect(env.string('EMPTY', { default: 'other' })).toBe('other');
            expect(env.errors).toEqual([]);
        });

        it('should record an error when a required variable is missing', () => {
            const env = reader({});
            expect(env.string('DATABASE_URL')).toBeUndefined();
            expect(env.errors).toEqual(['DATABASE_URL is required']);
        });

        it('should validate the minimum length without printing the value', () => {
            const env = reader({ SESSION_SECRET: 'short-secret' });
            expect(env.string('SESSION_SECRET', { minLength: 32 })).toBe('short-secret');
            expect(env.errors).toEqual(['SESSION_SECRET must have at least 32 characters']);
            expect(env.errors.join()).not.toContain('short-secret');
        });

        it('should validate the pattern, also with global regular expressions', () => {
            const env = reader({ CODE: 'abc', OTHER: 'ABC' });
            const pattern = /^[a-z]+$/g;
            env.string('CODE', { pattern });
            env.string('CODE', { pattern });
            env.string('OTHER', { pattern: /^[a-z]+$/ });
            expect(env.errors).toEqual(['OTHER must match the pattern /^[a-z]+$/']);
        });
    });

    describe('int', () => {
        it('should parse integers', () => {
            const env = reader({ PORT: '3000', NEGATIVE: '-5', SPACED: ' 42 ' });
            expect(env.int('PORT')).toBe(3000);
            expect(env.int('NEGATIVE')).toBe(-5);
            expect(env.int('SPACED')).toBe(42);
            expect(env.errors).toEqual([]);
        });

        it('should use the default value', () => {
            const env = reader({});
            expect(env.int('PORT', 3000)).toBe(3000);
            expect(env.int('WORKERS', { default: 2, min: 1 })).toBe(2);
            expect(env.errors).toEqual([]);
        });

        it('should record an error for values that are not integers', () => {
            const env = reader({ PORT: '30o0', DECIMAL: '1.5' });
            expect(env.int('PORT', 3000)).toBe(3000);
            env.int('DECIMAL');
            expect(env.errors).toEqual(['PORT must be an integer (received "30o0")', 'DECIMAL must be an integer (received "1.5")']);
        });

        it('should validate the minimum and the maximum', () => {
            const env = reader({ LOW: '0', HIGH: '70000', OK: '80' });
            env.int('LOW', { min: 1 });
            env.int('HIGH', { max: 65535 });
            expect(env.int('OK', { min: 1, max: 65535 })).toBe(80);
            expect(env.errors).toEqual(['LOW must be at least 1 (received "0")', 'HIGH must be at most 65535 (received "70000")']);
        });

        it('should truncate long received values', () => {
            const env = reader({ PORT: 'x'.repeat(100) });
            env.int('PORT');
            expect(env.errors[0]).toBe(`PORT must be an integer (received "${'x'.repeat(40)}…")`);
        });
    });

    describe('float', () => {
        it('should parse numbers with decimals', () => {
            const env = reader({ RATIO: '0.75', EXP: '1e3', SHORT: '.5' });
            expect(env.float('RATIO')).toBe(0.75);
            expect(env.float('EXP')).toBe(1000);
            expect(env.float('SHORT')).toBe(0.5);
            expect(env.errors).toEqual([]);
        });

        it('should record an error for values that are not numbers', () => {
            const env = reader({ RATIO: 'abc', INFINITE: '1e999' });
            expect(env.float('RATIO', 1)).toBe(1);
            env.float('INFINITE', { max: 10 });
            expect(env.errors).toEqual(['RATIO must be a number (received "abc")', 'INFINITE must be a number (received "1e999")']);
        });
    });

    describe('boolean', () => {
        it.each([
            ['true', true],
            ['TRUE', true],
            ['1', true],
            ['yes', true],
            ['on', true],
            ['false', false],
            ['0', false],
            ['No', false],
            ['off', false]
        ])('should read %s as %s', (value, expected) => {
            expect(reader({ FLAG: value }).boolean('FLAG')).toBe(expected);
        });

        it('should use the default value', () => {
            const env = reader({});
            expect(env.boolean('FLAG', false)).toBe(false);
            expect(env.errors).toEqual([]);
        });

        it('should record an error for invalid values', () => {
            const env = reader({ FLAG: 'maybe' });
            expect(env.boolean('FLAG', true)).toBe(true);
            expect(env.errors).toEqual(['FLAG must be a boolean (true, 1, yes, on, false, 0, no, off) (received "maybe")']);
        });
    });

    describe('enum', () => {
        it('should accept the allowed values', () => {
            const env = reader({ CACHE_STORE: 'redis' });
            const store: 'memory' | 'redis' = env.enum('CACHE_STORE', ['memory', 'redis'], 'memory');
            expect(store).toBe('redis');
            expect(env.errors).toEqual([]);
        });

        it('should use the default value', () => {
            expect(reader({}).enum('CACHE_STORE', ['memory', 'redis'], 'memory')).toBe('memory');
        });

        it('should record an error for values that are not allowed', () => {
            const env = reader({ CACHE_STORE: 'disk' });
            expect(env.enum('CACHE_STORE', ['memory', 'redis'], 'memory')).toBe('memory');
            expect(env.errors).toEqual(['CACHE_STORE must be one of memory, redis (received "disk")']);
        });
    });

    describe('url', () => {
        it('should accept valid URLs', () => {
            const env = reader({ DATABASE_URL: 'postgres://user:password@localhost:5432/orders' });
            expect(env.url('DATABASE_URL')).toBe('postgres://user:password@localhost:5432/orders');
            expect(env.url('OTHER_URL', 'http://localhost')).toBe('http://localhost');
            expect(env.errors).toEqual([]);
        });

        it('should record an error for invalid URLs without printing the value', () => {
            const env = reader({ DATABASE_URL: 'secret-value' });
            env.url('DATABASE_URL');
            expect(env.errors).toEqual(['DATABASE_URL must be a valid URL']);
        });

        it('should validate the protocol', () => {
            const env = reader({ API_URL: 'ftp://example.com', WEB_URL: 'https://example.com' });
            env.url('API_URL', { protocols: ['http', 'https'] });
            env.url('WEB_URL', { protocols: ['http', 'https'] });
            expect(env.errors).toEqual(['API_URL must use one of the protocols http, https (received "ftp")']);
        });

        it('should use the default value from the options', () => {
            expect(reader({}).url('API_URL', { default: 'http://localhost:3000' })).toBe('http://localhost:3000');
        });
    });

    describe('json', () => {
        it('should parse JSON values', () => {
            const env = reader({ LIMITS: '{"max":10}' });
            expect(env.json<{ max: number }>('LIMITS')).toEqual({ max: 10 });
            expect(env.json('OTHER', [1])).toEqual([1]);
        });

        it('should record an error for invalid JSON without printing the value', () => {
            const env = reader({ CREDENTIALS: '{secret' });
            expect(env.json('CREDENTIALS', {})).toEqual({});
            expect(env.errors).toEqual(['CREDENTIALS must be valid JSON']);
        });

        it('should record an error when a required JSON variable is missing', () => {
            const env = reader({});
            env.json('CREDENTIALS');
            expect(env.errors).toEqual(['CREDENTIALS is required']);
        });
    });

    describe('list', () => {
        it('should split comma-separated values', () => {
            const env = reader({ ORIGINS: 'a.com, b.com,,c.com ' });
            expect(env.list('ORIGINS')).toEqual(['a.com', 'b.com', 'c.com']);
        });

        it('should use a custom separator', () => {
            expect(reader({ PATHS: '/a;/b' }).list('PATHS', { separator: ';' })).toEqual(['/a', '/b']);
        });

        it('should use the default value', () => {
            const env = reader({});
            expect(env.list('ORIGINS', [])).toEqual([]);
            expect(env.list('HOSTS', { default: ['localhost'] })).toEqual(['localhost']);
            expect(env.errors).toEqual([]);
        });

        it('should record an error when a required list is missing', () => {
            const env = reader({});
            env.list('ORIGINS');
            expect(env.errors).toEqual(['ORIGINS is required']);
        });
    });

    it('should collect every error in order', () => {
        const env = reader({ PORT: 'abc' });
        env.string('DATABASE_URL');
        env.int('PORT');
        env.boolean('DEBUG');
        expect(env.errors).toEqual(['DATABASE_URL is required', 'PORT must be an integer (received "abc")', 'DEBUG is required']);
    });

    it('should return a copy of the errors', () => {
        const env = reader({});
        env.string('A');
        (env.errors as string[]).push('other');
        expect(env.errors).toEqual(['A is required']);
    });
});
