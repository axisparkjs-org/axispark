import { AxiSparkCore, HealthEngine } from '@axisparkjs/core';
import { DataPlugin } from '@axisparkjs/data';
import { HttpPlugin } from '@axisparkjs/http';
import { AxiSparkTestFactory } from '@axisparkjs/test';
import { app as appPg } from '@axisparkjs/samples/data-persistence/src/app.pg';
import { app as appMySQL } from '@axisparkjs/samples/data-persistence/src/app.mysql';
import { app as appMongoDB } from '@axisparkjs/samples/data-persistence/src/app.mongodb';

const baseUrl = `http://localhost:3000/api`;

const customers = [
    { email: 'alice@example.com', name: 'Alice', status: 'active', age: 30 },
    { email: 'bob@example.com', name: 'Bob', status: 'active', age: 20 },
    { email: 'carol@example.com', name: 'Carol', status: 'inactive', age: 50 },
    { email: 'dave@example.com', name: 'Dave', status: 'active', age: 35 }
];

const postJson = (path: string, body: unknown) =>
    fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

const responseJson = <T>(response: Response) => response.json() as Promise<T>;

const seedCustomers = async () => {
    const response = await postJson('/customers', customers);
    expect(response.status).toBe(201);
    return responseJson<unknown[]>(response);
};

describe.each([
    { name: 'PostgreSQL', app: appPg },
    { name: 'MySQL', app: appMySQL },
    { name: 'MongoDB', app: appMongoDB }
])('Data Persistence App ($name)', ({ app }) => {
    let axiSparkCore: AxiSparkCore;

    beforeAll(async () => {
        axiSparkCore = AxiSparkTestFactory.create({ app });
        await axiSparkCore.init();
        await axiSparkCore.run();
    });

    beforeEach(async () => {
        const [customersResponse, auditResponse] = await Promise.all([
            fetch(`${baseUrl}/customers`, { method: 'DELETE' }),
            fetch(`${baseUrl}/audit-records`, { method: 'DELETE' })
        ]);
        expect(customersResponse.status).toBe(204);
        expect(auditResponse.status).toBe(204);
    });

    it('should create an instance of AxiSparkTestCore', () => {
        expect(axiSparkCore).toBeInstanceOf(AxiSparkCore);
    });

    it('registers the Data and HTTP plugins', () => {
        expect(axiSparkCore.used()).toEqual(
            expect.arrayContaining([expect.objectContaining({ type: DataPlugin }), expect.objectContaining({ type: HttpPlugin })])
        );
    });

    it('initializes and injects both named data sources', async () => {
        const [primaryResponse, reportingResponse] = await Promise.all([fetch(`${baseUrl}/customers/source`), fetch(`${baseUrl}/audit-records/source`)]);

        expect(primaryResponse.status).toBe(200);
        expect(await primaryResponse.json()).toEqual({ initialized: true, database: 'axispark_testing' });
        expect(reportingResponse.status).toBe(200);
        expect(await reportingResponse.json()).toEqual({ initialized: true, database: 'axispark_testing' });
    });

    it('saves, finds, counts, checks existence, and removes one or many entities', async () => {
        const savedCustomers = await seedCustomers();
        const saveAuditResponse = await postJson('/audit-records', [
            { action: 'customer.created', subject: 'alice@example.com' },
            { action: 'customer.updated', subject: 'bob@example.com' }
        ]);
        expect(saveAuditResponse.status).toBe(201);

        const [customerListResponse, auditListResponse] = await Promise.all([fetch(`${baseUrl}/customers`), fetch(`${baseUrl}/audit-records`)]);
        expect(await customerListResponse.json()).toHaveLength(4);
        expect(await auditListResponse.json()).toHaveLength(2);
        expect(savedCustomers).toHaveLength(4);

        const oneResponse = await fetch(`${baseUrl}/customers/one?email=alice%40example.com`);
        expect((await responseJson<{ email: string }>(oneResponse)).email).toBe('alice@example.com');

        const countResponse = await fetch(`${baseUrl}/customers/count?status=active`);
        expect(await countResponse.json()).toBe(3);

        const existsResponse = await fetch(`${baseUrl}/customers/exists?email=dave%40example.com`);
        expect(await existsResponse.json()).toBe(true);
        const missingResponse = await fetch(`${baseUrl}/customers/exists?email=missing%40example.com`);
        expect(await missingResponse.json()).toBe(false);

        const removeOneResponse = await fetch(`${baseUrl}/customers/one?email=bob%40example.com`, { method: 'DELETE' });
        expect(removeOneResponse.status).toBe(204);
        const removedCustomerExists = await fetch(`${baseUrl}/customers/exists?email=bob%40example.com`);
        expect(await removedCustomerExists.json()).toBe(false);

        const removeManyResponse = await fetch(`${baseUrl}/customers`, { method: 'DELETE' });
        expect(removeManyResponse.status).toBe(204);
        expect(await (await fetch(`${baseUrl}/customers`)).json()).toEqual([]);
    });

    it('executes derived AND/OR predicates with ordering', async () => {
        await seedCustomers();

        const response = await fetch(`${baseUrl}/customers/search?status=active&age=25&email=carol%40example.com`);

        expect(response.status).toBe(200);
        const result = await responseJson<{ email: string }[]>(response);
        expect(result.map((customer: { email: string }) => customer.email)).toEqual(['alice@example.com', 'carol@example.com', 'dave@example.com']);
    });

    it('applies descending ordering and page offsets', async () => {
        await seedCustomers();

        const firstPageResponse = await fetch(`${baseUrl}/customers/page?status=active&page=0&size=2`);
        const secondPageResponse = await fetch(`${baseUrl}/customers/page?status=active&page=1&size=2`);

        expect((await responseJson<{ email: string }[]>(firstPageResponse)).map((customer) => customer.email)).toEqual([
            'dave@example.com',
            'alice@example.com'
        ]);
        expect((await responseJson<{ email: string }[]>(secondPageResponse)).map((customer) => customer.email)).toEqual(['bob@example.com']);
    });

    it('should report the connections as healthy', async () => {
        const healthEngine = await axiSparkCore.get(HealthEngine);

        const checks = await healthEngine.checkAll();

        expect(checks[0].status).toBe('healthy');
        expect(checks).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    component: 'data:PRIMARY',
                    status: 'healthy',
                    details: expect.objectContaining({ critical: true })
                }),
                expect.objectContaining({
                    component: 'data:REPORTING',
                    status: 'healthy',
                    details: expect.objectContaining({ critical: true })
                })
            ])
        );
    });

    afterAll(async () => {
        if (axiSparkCore) await axiSparkCore.destroy();
    });
});
