import { DataSource, EntityManager } from 'typeorm';
import { TransactionContext } from './transaction-context';
import { TransactionManager } from './transaction-manager';

const createDataSource = (type = 'postgres') => {
    const dataSource: any = {
        options: { type },
        manager: { name: `${type}-default-manager` },
        transaction: jest.fn(async (...args: unknown[]) => {
            const run = args[args.length - 1] as (manager: EntityManager) => Promise<unknown>;
            const manager = { name: `${type}-transactional-manager` } as unknown as EntityManager;
            try {
                const result = await run(manager);
                dataSource.committed.push(manager);
                return result;
            } catch (error) {
                dataSource.rolledBack.push(manager);
                throw error;
            }
        }),
        committed: [] as EntityManager[],
        rolledBack: [] as EntityManager[]
    };
    return dataSource as DataSource & { transaction: jest.Mock; committed: EntityManager[]; rolledBack: EntityManager[] };
};

describe('TransactionManager', () => {
    const logger = { warn: jest.fn().mockResolvedValue(undefined) };

    const createManager = (connections: Record<string, DataSource>) =>
        new TransactionManager({ getAllConnections: () => new Map(Object.entries(connections)) } as any, logger as any);

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('runs the callback in a transaction of the only data source and commits its result', async () => {
        const dataSource = createDataSource();
        const manager = createManager({ PRIMARY: dataSource });

        const result = await manager.runInTransaction(async (entityManager) => {
            expect(TransactionContext.getEntityManager(dataSource)).toBe(entityManager);
            return 'done';
        });

        expect(result).toBe('done');
        expect(dataSource.transaction).toHaveBeenCalledTimes(1);
        expect(dataSource.transaction).toHaveBeenCalledWith(expect.any(Function));
        expect(dataSource.committed).toHaveLength(1);
        expect(TransactionContext.isActive(dataSource)).toBe(false);
    });

    it('rolls back and rethrows when the callback fails', async () => {
        const dataSource = createDataSource();
        const manager = createManager({ PRIMARY: dataSource });
        const failure = new Error('failed');

        await expect(
            manager.runInTransaction(() => {
                throw failure;
            })
        ).rejects.toBe(failure);

        expect(dataSource.rolledBack).toHaveLength(1);
        expect(dataSource.committed).toHaveLength(0);
    });

    it('passes the isolation level to TypeORM', async () => {
        const dataSource = createDataSource();
        const manager = createManager({ PRIMARY: dataSource });

        await manager.runInTransaction(async () => undefined, { isolationLevel: 'SERIALIZABLE' });

        expect(dataSource.transaction).toHaveBeenCalledWith('SERIALIZABLE', expect.any(Function));
    });

    it('selects the data source by name', async () => {
        const primary = createDataSource();
        const reporting = createDataSource();
        const manager = createManager({ PRIMARY: primary, REPORTING: reporting });

        await manager.runInTransaction(
            async () => {
                expect(TransactionContext.isActive(reporting)).toBe(true);
                expect(TransactionContext.isActive(primary)).toBe(false);
            },
            { dataSource: 'REPORTING' }
        );

        expect(reporting.transaction).toHaveBeenCalledTimes(1);
        expect(primary.transaction).not.toHaveBeenCalled();
    });

    it('requires the data source name when several data sources are configured', async () => {
        const manager = createManager({ PRIMARY: createDataSource(), REPORTING: createDataSource() });

        await expect(manager.runInTransaction(async () => undefined)).rejects.toThrow(
            "The 'dataSource' transaction option is required when 2 data sources are configured. Available data sources: PRIMARY, REPORTING."
        );
    });

    it('rejects unknown data sources', async () => {
        const manager = createManager({ PRIMARY: createDataSource() });

        await expect(manager.runInTransaction(async () => undefined, { dataSource: 'primary' })).rejects.toThrow(
            "Data source 'primary' not found. Available data sources: PRIMARY."
        );
    });

    it('joins the open transaction of the same data source in nested calls', async () => {
        const dataSource = createDataSource();
        const manager = createManager({ PRIMARY: dataSource });

        await manager.runInTransaction(async (outer) => {
            await manager.runInTransaction(async (inner) => expect(inner).toBe(outer), { isolationLevel: 'SERIALIZABLE' });
        });

        expect(dataSource.transaction).toHaveBeenCalledTimes(1);
        expect(dataSource.committed).toHaveLength(1);
    });

    it('rolls back the outer transaction when a nested call fails', async () => {
        const dataSource = createDataSource();
        const manager = createManager({ PRIMARY: dataSource });
        const failure = new Error('nested failure');

        await expect(
            manager.runInTransaction(async () => {
                await manager.runInTransaction(async () => {
                    throw failure;
                });
            })
        ).rejects.toBe(failure);

        expect(dataSource.transaction).toHaveBeenCalledTimes(1);
        expect(dataSource.rolledBack).toHaveLength(1);
    });

    it('opens a separate transaction for another data source and keeps the outer one active', async () => {
        const primary = createDataSource();
        const reporting = createDataSource();
        const manager = createManager({ PRIMARY: primary, REPORTING: reporting });

        await manager.runInTransaction(
            async (outer) => {
                await manager.runInTransaction(
                    async () => {
                        expect(TransactionContext.getEntityManager(primary)).toBe(outer);
                        expect(TransactionContext.isActive(reporting)).toBe(true);
                    },
                    { dataSource: 'REPORTING' }
                );
                expect(TransactionContext.isActive(reporting)).toBe(false);
            },
            { dataSource: 'PRIMARY' }
        );

        expect(primary.transaction).toHaveBeenCalledTimes(1);
        expect(reporting.transaction).toHaveBeenCalledTimes(1);
    });

    it('keeps concurrent transactions isolated from each other', async () => {
        const dataSource = createDataSource();
        const manager = createManager({ PRIMARY: dataSource });
        const managers: EntityManager[] = [];

        await Promise.all(
            [1, 2].map(() =>
                manager.runInTransaction(async (entityManager) => {
                    await new Promise((resolve) => setImmediate(resolve));
                    expect(TransactionContext.getEntityManager(dataSource)).toBe(entityManager);
                    managers.push(entityManager);
                })
            )
        );

        expect(dataSource.transaction).toHaveBeenCalledTimes(2);
        expect(managers[0]).not.toBe(managers[1]);
    });

    it('runs MongoDB callbacks without a transaction and warns once per data source', async () => {
        const dataSource = createDataSource('mongodb');
        const manager = createManager({ PRIMARY: dataSource });

        const first = await manager.runInTransaction(async (entityManager) => {
            expect(entityManager).toBe(dataSource.manager);
            expect(TransactionContext.isActive(dataSource)).toBe(false);
            return 1;
        });
        await manager.runInTransaction(async () => 2);

        expect(first).toBe(1);
        expect(dataSource.transaction).not.toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalledTimes(1);
        expect(logger.warn).toHaveBeenCalledWith("Data source 'PRIMARY' uses MongoDB: transactional methods run without a transaction.");
    });

    it('exposes the active transaction manager while it is registered', () => {
        const manager = createManager({});
        const other = createManager({});

        TransactionManager.setActive(manager);
        expect(TransactionManager.getActive()).toBe(manager);

        TransactionManager.clearActive(other);
        expect(TransactionManager.getActive()).toBe(manager);

        TransactionManager.clearActive(manager);
        expect(() => TransactionManager.getActive()).toThrow(
            'No TransactionManager is available. Register the DataPlugin before running transactional methods.'
        );
    });
});
