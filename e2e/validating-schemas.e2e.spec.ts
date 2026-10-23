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

    afterAll(async () => {
        await axiSparkCore.destroy();
    });
});
