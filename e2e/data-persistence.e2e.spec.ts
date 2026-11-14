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
    { name: 'PostgreSQL', app: appPg, transactional: true },
    { name: 'MySQL', app: appMySQL, transactional: true },
    // MongoDB data sources run transactional methods without a transaction.
    { name: 'MongoDB', app: appMongoDB, transactional: false }
])('Data Persistence App ($name)', ({ app, transactional }) => {
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

        const firstPage = await responseJson<{ content: { email: string }[]; page: number; size: number; totalElements: number; totalPages: number }>(
            firstPageResponse
        );
        const secondPage = await responseJson<{ content: { email: string }[]; page: number; totalElements: number }>(secondPageResponse);

        expect(firstPage.content.map((customer) => customer.email)).toEqual(['dave@example.com', 'alice@example.com']);
        expect(firstPage).toEqual(expect.objectContaining({ page: 0, size: 2, totalElements: 3, totalPages: 2 }));
        expect(secondPage.content.map((customer) => customer.email)).toEqual(['bob@example.com']);
        expect(secondPage).toEqual(expect.objectContaining({ page: 1, totalElements: 3 }));
    });

    it('finds pages of non-derived queries with the totals', async () => {
        await seedCustomers();

        const response = await fetch(`${baseUrl}/customers/all-pages?page=1&size=3`);
        const page = await responseJson<{ content: { name: string }[]; totalElements: number; totalPages: number }>(response);

        expect(page.content.map((customer) => customer.name)).toEqual(['Dave']);
        expect(page).toEqual(expect.objectContaining({ totalElements: 4, totalPages: 2 }));
    });

    it('executes the Not, NotIn, Containing, StartingWith and IgnoreCase keywords', async () => {
        await seedCustomers();
        const names = async (path: string) =>
            (await responseJson<{ name: string }[]>(await fetch(`${baseUrl}/customers${path}`))).map((customer) => customer.name);

        expect(await names('/named?name=AR')).toEqual(['Carol']);
        expect(await names('/named?name=a')).toEqual(['Alice', 'Carol', 'Dave']);
        // The wildcards of the value are matched literally.
        expect(await names('/named?name=%25')).toEqual([]);
        expect(await names('/named?name=_')).toEqual([]);
        expect(await names('/other-status?status=active')).toEqual(['Carol']);
        expect(await names('/excluding?status=inactive&status=archived')).toEqual(['Alice', 'Bob', 'Dave']);
        expect(await names('/adults-by-email?prefix=d&age=30')).toEqual(['Dave']);
    });

    it('finds, checks and deletes entities by primary key', async () => {
        const saved = await seedCustomers();
        const [alice, bob] = saved as { _id: string | number; email: string }[];

        const found = await responseJson<{ customer: { email: string } | null; exists: boolean }>(await fetch(`${baseUrl}/customers/by-id/${alice._id}`));
        expect(found.customer?.email).toBe('alice@example.com');
        expect(found.exists).toBe(true);

        const many = await responseJson<{ email: string }[]>(await fetch(`${baseUrl}/customers/by-ids?id=${alice._id}&id=${bob._id}`));
        expect(many.map((customer) => customer.email).sort()).toEqual(['alice@example.com', 'bob@example.com']);

        const deleted = await responseJson<{ deleted: number }>(await postJson(`/customers/by-id/${alice._id}/delete`, {}));
        expect(deleted.deleted).toBe(1);

        const missing = await responseJson<{ customer: unknown; exists: boolean }>(await fetch(`${baseUrl}/customers/by-id/${alice._id}`));
        expect(missing).toEqual({ customer: null, exists: false });

        const deletedAgain = await responseJson<{ deleted: number }>(await postJson(`/customers/by-id/${alice._id}/delete`, {}));
        expect(deletedAgain.deleted).toBe(0);
    });

    it('deletes the entities that match a derived query', async () => {
        await seedCustomers();

        const response = await postJson('/customers/delete-by-status?status=active', {});

        expect(await response.json()).toEqual({ deleted: 3 });
        expect((await responseJson<{ email: string }[]>(await fetch(`${baseUrl}/customers`))).map((customer) => customer.email)).toEqual(['carol@example.com']);
        expect(await (await postJson('/customers/delete-by-status?status=active', {})).json()).toEqual({ deleted: 0 });
    });

    it(transactional ? 'rolls back a derived delete when the transaction fails' : 'keeps a derived delete when the method throws', async () => {
        await seedCustomers();

        const committed = await postJson('/customers/purge?status=inactive', {});
        expect(await committed.json()).toEqual({ deleted: 1 });

        const failed = await postJson('/customers/purge?status=active&fail=true', {});
        expect(failed.status).toBe(409);
        expect(await (await fetch(`${baseUrl}/customers`)).json()).toHaveLength(transactional ? 3 : 0);
    });

    describe.each([
        { mode: '@Transactional', path: '/customers/register' },
        { mode: 'TransactionManager', path: '/customers/register-programmatically' }
    ])('transactions with $mode', ({ path }) => {
        it('commits every change, and derived queries see the changes of the transaction', async () => {
            const response = await postJson(path, customers);

            expect(response.status).toBe(201);
            expect(await response.json()).toEqual({ registered: 4, active: 3 });
            expect(await (await fetch(`${baseUrl}/customers`)).json()).toHaveLength(4);
        });

        it(transactional ? 'rolls back every change when the method throws' : 'keeps the changes when the method throws', async () => {
            const response = await postJson(`${path}?fail=true`, customers);

            expect(response.status).toBe(409);
            expect(await (await fetch(`${baseUrl}/customers`)).json()).toHaveLength(transactional ? 0 : 4);
        });
    });

    if (transactional) {
        it('rolls back the nested transactional calls when a database error happens', async () => {
            await postJson('/customers', [customers[0]]);

            const response = await postJson('/customers/register', [customers[1], customers[0]]);

            expect(response.status).toBe(500);
            const stored = await responseJson<{ email: string }[]>(await fetch(`${baseUrl}/customers`));
            expect(stored.map((customer) => customer.email)).toEqual([customers[0].email]);
        });
    }

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
