import { AxiSparkTestFactory } from '@axisparkjs/test';
import { AxiSparkCore } from '@axisparkjs/core';
import { app as appExpress } from '@axisparkjs/samples/validating-schemas/src/app-express';
import { app as appFastify } from '@axisparkjs/samples/validating-schemas/src/app-fastify';

const validUser = { email: 'user@axispark.dev', name: 'Ada', age: 30 };

const post = (path: string, body: unknown) =>
    fetch(`http://localhost:3000/api/users${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

const errorOf = async (response: Response): Promise<string> => ((await response.json()) as { error: string }).error;

describe.each([
    { name: 'Express', app: appExpress },
    { name: 'Fastify', app: appFastify }
])('Validating Schemas App ($name)', ({ app }) => {
    let axiSparkCore: AxiSparkCore;

    beforeAll(async () => {
        axiSparkCore = AxiSparkTestFactory.create({
            app
        });
        await axiSparkCore.init();
        await axiSparkCore.run();
    });

    it('should accept a valid body and inject an instance of the DTO class', async () => {
        const response = await post('', validUser);

        expect(response.status).toBe(201);
        expect(await response.json()).toEqual({ ...validUser, isDto: true });
    });

    it('should reject an invalid body with every failing constraint', async () => {
        const response = await post('', { email: 'not-an-email', name: 'A', age: 17 });

        expect(response.status).toBe(400);
        const body = (await response.json()) as { error: string; status: number; cause: string };
        expect(body).toMatchObject({ status: 400, cause: 'PipeStepValidationError' });
        const error = body.error;
        expect(error).toContain("Validation failed for 'body'");
        expect(error).toContain('email: email must be an email');
        expect(error).toContain('name: name must be longer than or equal to 2 characters');
        expect(error).toContain('age: age must not be less than 18');
    });

    it('should reject a body that is not an object', async () => {
        const response = await post('', [validUser]);

        expect(response.status).toBe(400);
        expect(await errorOf(response)).toContain("Value must be an object matching 'CreateUserDto'");
    });

    it('should keep unknown properties when no options are configured', async () => {
        const response = await post('', { ...validUser, extra: 'kept' });

        expect(response.status).toBe(201);
        expect(await response.json()).toMatchObject({ extra: 'kept' });
    });

    it('should strip unknown properties with the whitelist option', async () => {
        const response = await post('/whitelisted', { ...validUser, extra: 'stripped' });

        expect(response.status).toBe(201);
        expect(await response.json()).toEqual(validUser);
    });

    it('should reject unknown properties with the forbidNonWhitelisted option', async () => {
        const response = await post('/strict', { ...validUser, extra: 'forbidden' });

        expect(response.status).toBe(400);
        expect(await errorOf(response)).toContain('extra: property extra should not exist');
    });

    it('should apply validation groups from the options', async () => {
        const accepted = await post('/admin', { ...validUser, role: 'admin' });
        const rejected = await post('/admin', { ...validUser, role: 42 });

        expect(accepted.status).toBe(201);
        expect(rejected.status).toBe(400);
        expect(await errorOf(rejected)).toContain('role: role must be a string');
    });

    it('should report that schema validation requires a class-typed parameter', async () => {
        const response = await post('/untyped', validUser);

        expect(response.status).toBe(500);
        expect(await errorOf(response)).toContain('requires a class-typed parameter');
    });

    describe('built-in pipe-steps', () => {
        const get = (path: string) => fetch(`http://localhost:3000/api/orders${path}`);

        it('should use the default values of the missing query parameters', async () => {
            const response = await get('');

            expect(response.status).toBe(200);
            expect(await response.json()).toEqual({ page: 1, status: 'open', from: null, tags: [], ids: [] });
        });

        it('should parse every query parameter', async () => {
            const response = await get('?page=3&status=SHIPPED&from=2026-03-01T10:30:00%2B02:00&tags=a,b&tags=c&ids=1,2');

            expect(response.status).toBe(200);
            expect(await response.json()).toEqual({ page: 3, status: 'shipped', from: '2026-03-01T08:30:00.000Z', tags: ['a', 'b', 'c'], ids: [1, 2] });
        });

        it('should reject values that are not in the enum', async () => {
            const response = await get('?status=pending');

            expect(response.status).toBe(400);
            expect(await errorOf(response)).toContain('is not one of the allowed values: open, shipped, cancelled');
        });

        it('should reject invalid dates', async () => {
            const response = await get('?from=2026-02-30');

            expect(response.status).toBe(400);
            expect(await errorOf(response)).toContain('is not a valid ISO 8601 date');
        });

        it('should validate the items of the arrays', async () => {
            const repeated = await get('?tags=a,a');
            const invalid = await get('?ids=1,x');

            expect(repeated.status).toBe(400);
            expect(await errorOf(repeated)).toContain('Array items must be unique.');
            expect(invalid.status).toBe(400);
            expect(await errorOf(invalid)).toContain('is not a valid integer');
        });

        it('should accept UUIDs and return them in lower case', async () => {
            const response = await get('/9B2F8F4E-3C1A-4D7E-9A6B-2F1C3D4E5F60');

            expect(response.status).toBe(200);
            expect(await response.json()).toEqual({ id: '9b2f8f4e-3c1a-4d7e-9a6b-2f1c3d4e5f60' });
        });

        it('should reject values that are not UUIDs, or not of the expected version', async () => {
            const invalid = await get('/123');
            const wrongVersion = await get('/v7/9b2f8f4e-3c1a-4d7e-9a6b-2f1c3d4e5f60');
            const v7 = await get('/v7/01890a5d-ac96-774b-bcce-b302099a8057');

            expect(invalid.status).toBe(400);
            expect(await errorOf(invalid)).toContain('is not a valid UUID');
            expect(wrongVersion.status).toBe(400);
            expect(await errorOf(wrongVersion)).toContain('is not a valid UUID v7');
            expect(v7.status).toBe(200);
        });
    });

    afterAll(async () => {
        await axiSparkCore.destroy();
    });
});
