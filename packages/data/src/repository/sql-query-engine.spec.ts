import { Brackets, ObjectLiteral, Repository } from 'typeorm';
import { TransactionContext } from '../transactions/transaction-context';
import { BaseRepository } from './base-repository';
import { PageRequest } from './query-engine';
import { QueryMethodParser } from './query-method-parser';
import { SQLQueryEngine } from './sql-query-engine';

interface TestEntity extends ObjectLiteral {
    id: number;
    status: string;
    email: string;
    age: number;
    createdAt: Date;
    name: string;
    score: number;
}

describe('SQLQueryEngine', () => {
    let engine: SQLQueryEngine;
    let repository: Repository<TestEntity>;
    let queryBuilder: any;

    beforeEach(() => {
        engine = new SQLQueryEngine(new QueryMethodParser());
        queryBuilder = {
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            orWhere: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            addOrderBy: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            take: jest.fn().mockReturnThis(),
            getMany: jest.fn().mockResolvedValue([]),
            getOne: jest.fn().mockResolvedValue(null),
            getCount: jest.fn().mockResolvedValue(0),
            getManyAndCount: jest.fn().mockResolvedValue([[], 0])
        };
        repository = {
            metadata: {
                columns: ['id', 'status', 'email', 'age', 'createdAt', 'name', 'score', 'active'].map((propertyName) => ({
                    propertyName,
                    propertyPath: propertyName
                }))
            },
            createQueryBuilder: jest.fn().mockReturnValue(queryBuilder)
        } as unknown as Repository<TestEntity>;
    });

    const execute = (methodName: string, methodArgs: unknown[] = []) => engine.execute({} as BaseRepository<TestEntity>, methodName, [repository], methodArgs);

    const nestedWhereFor = (brackets: Brackets) => {
        const nestedWhere = {
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis()
        };
        brackets.whereFactory(nestedWhere as any);
        return nestedWhere;
    };

    it('builds AND predicates with ordered parameters', async () => {
        await execute('findByStatusAndAgeGreaterThan', ['active', 18]);

        const [brackets] = queryBuilder.where.mock.calls[0];
        const nestedWhere = nestedWhereFor(brackets);
        expect(nestedWhere.where).toHaveBeenCalledWith('entity.status = :queryArg0', { queryArg0: 'active' });
        expect(nestedWhere.andWhere).toHaveBeenCalledWith('entity.age > :queryArg1', { queryArg1: 18 });
        expect(queryBuilder.getMany).toHaveBeenCalledTimes(1);
    });

    it('groups AND clauses before OR clauses', async () => {
        await execute('findByStatusAndAgeGreaterThanOrEmail', ['active', 18, 'a@example.com']);

        expect(queryBuilder.where).toHaveBeenCalledTimes(1);
        expect(queryBuilder.orWhere).toHaveBeenCalledTimes(1);

        const firstGroup = nestedWhereFor(queryBuilder.where.mock.calls[0][0]);
        expect(firstGroup.where).toHaveBeenCalledWith('entity.status = :queryArg0', { queryArg0: 'active' });
        expect(firstGroup.andWhere).toHaveBeenCalledWith('entity.age > :queryArg1', { queryArg1: 18 });

        const secondGroup = nestedWhereFor(queryBuilder.orWhere.mock.calls[0][0]);
        expect(secondGroup.where).toHaveBeenCalledWith('entity.email = :queryArg2', { queryArg2: 'a@example.com' });
    });

    it('applies multiple sort fields and zero-based page options', async () => {
        const page: PageRequest = { page: 2, size: 10 };
        await execute('findByStatusOrderByCreatedAtDescAndNameAsc', ['active', page]);

        expect(queryBuilder.orderBy).toHaveBeenCalledWith('entity.createdAt', 'DESC');
        expect(queryBuilder.addOrderBy).toHaveBeenCalledWith('entity.name', 'ASC');
        expect(queryBuilder.skip).toHaveBeenCalledWith(20);
        expect(queryBuilder.take).toHaveBeenCalledWith(10);
        expect(queryBuilder.getManyAndCount).toHaveBeenCalledTimes(1);
    });

    it.each([
        ['findByScoreLessThan', [10], 'entity.score < :queryArg0', { queryArg0: 10 }],
        ['findByScoreLessThanEqual', [10], 'entity.score <= :queryArg0', { queryArg0: 10 }],
        ['findByScoreGreaterThan', [10], 'entity.score > :queryArg0', { queryArg0: 10 }],
        ['findByScoreGreaterThanEqual', [10], 'entity.score >= :queryArg0', { queryArg0: 10 }],
        ['findByScoreBetween', [5, 10], 'entity.score BETWEEN :queryArg0 AND :queryArg1', { queryArg0: 5, queryArg1: 10 }],
        ['findByScoreIn', [[5, 10]], 'entity.score IN (:...queryArg0)', { queryArg0: [5, 10] }],
        ['findByScoreIn', [[]], '1 = 0', {}],
        ['findByScoreNotIn', [[5, 10]], 'entity.score NOT IN (:...queryArg0)', { queryArg0: [5, 10] }],
        ['findByScoreNotIn', [[]], '1 = 1', {}],
        ['findByStatusNot', ['archived'], 'entity.status <> :queryArg0', { queryArg0: 'archived' }],
        ['findByStatusNotIgnoreCase', ['Archived'], 'LOWER(entity.status) <> LOWER(:queryArg0)', { queryArg0: 'Archived' }],
        ['findByNameIgnoreCase', ['Phone'], 'LOWER(entity.name) = LOWER(:queryArg0)', { queryArg0: 'Phone' }],
        ['findByNameLikeIgnoreCase', ['ph%'], 'LOWER(entity.name) LIKE LOWER(:queryArg0)', { queryArg0: 'ph%' }],
        ['findByNameContaining', ['10%_off!'], "entity.name LIKE :queryArg0 ESCAPE '!'", { queryArg0: '%10!%!_off!!%' }],
        ['findByNameContainingIgnoreCase', ['ph'], "LOWER(entity.name) LIKE LOWER(:queryArg0) ESCAPE '!'", { queryArg0: '%ph%' }],
        ['findByNameStartingWith', ['ph'], "entity.name LIKE :queryArg0 ESCAPE '!'", { queryArg0: 'ph%' }],
        ['findByNameEndingWith', ['ph'], "entity.name LIKE :queryArg0 ESCAPE '!'", { queryArg0: '%ph' }],
        ['findByActiveTrue', [], 'entity.active = :queryConst0', { queryConst0: true }],
        ['findByActiveFalse', [], 'entity.active = :queryConst0', { queryConst0: false }],
        ['findByNameLike', ['A%'], 'entity.name LIKE :queryArg0', { queryArg0: 'A%' }],
        ['findByNameIsNull', [], 'entity.name IS NULL', {}],
        ['findByNameIsNotNull', [], 'entity.name IS NOT NULL', {}]
    ])('supports the derived operator in %s', async (methodName, args, expectedSql, expectedParameters) => {
        await execute(methodName as string, args as unknown[]);

        const nestedWhere = nestedWhereFor(queryBuilder.where.mock.calls[0][0]);
        expect(nestedWhere.where).toHaveBeenCalledWith(expectedSql, expectedParameters);
    });

    it('dispatches findOneBy, countBy, and existsBy to the matching result method', async () => {
        queryBuilder.getOne.mockResolvedValue({ id: 1 });
        queryBuilder.getCount.mockResolvedValue(2);

        await expect(execute('findOneById', [1])).resolves.toEqual({ id: 1 });
        expect(queryBuilder.getOne).toHaveBeenCalledTimes(1);

        await expect(execute('countByStatus', ['active'])).resolves.toBe(2);
        expect(queryBuilder.getCount).toHaveBeenCalledTimes(1);

        await expect(execute('existsByStatus', ['active'])).resolves.toBe(true);
        expect(queryBuilder.getCount).toHaveBeenCalledTimes(2);

        queryBuilder.getCount.mockResolvedValue(0);
        await expect(execute('existsByStatus', ['inactive'])).resolves.toBe(false);
    });

    it('rejects incorrect parameter counts', async () => {
        await expect(execute('findByStatus')).rejects.toThrow('expected 1 argument(s), received 0');
    });

    it('rejects ordering for count and exists operations', async () => {
        await expect(execute('countByStatusOrderByCreatedAtAsc', ['active'])).rejects.toThrow('OrderBy is not supported');
    });

    it('uses ascending order when a direction is omitted', async () => {
        await execute('findByStatusOrderByName', ['active']);

        expect(queryBuilder.orderBy).toHaveBeenCalledWith('entity.name', 'ASC');
    });

    it('rejects invalid repository arguments', async () => {
        await expect(engine.execute({} as BaseRepository<TestEntity>, 'findByStatus', [], ['active'])).rejects.toThrow(
            'must be the first repository constructor argument'
        );
    });

    it('runs the query on the transactional repository when a transaction is open on the data source', async () => {
        const dataSource = { options: { type: 'postgres' } } as any;
        const transactionalQueryBuilder = { ...queryBuilder, getMany: jest.fn().mockResolvedValue([{ id: 1 }]) };
        const transactionalRepository = { ...repository, createQueryBuilder: jest.fn().mockReturnValue(transactionalQueryBuilder) };
        const manager = { getRepository: jest.fn().mockReturnValue(transactionalRepository) } as any;
        (repository as any).target = 'TestEntity';

        const result = await TransactionContext.run(dataSource, manager, () =>
            engine.execute({} as BaseRepository<TestEntity>, 'findByStatus', [repository, dataSource], ['active'])
        );

        expect(result).toEqual([{ id: 1 }]);
        expect(manager.getRepository).toHaveBeenCalledWith('TestEntity');
        expect(repository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('uses the default repository outside a transaction of its data source', async () => {
        const dataSource = { options: { type: 'postgres' } } as any;
        const otherDataSource = { options: { type: 'postgres' } } as any;
        const manager = { getRepository: jest.fn() } as any;

        await TransactionContext.run(otherDataSource, manager, () =>
            engine.execute({} as BaseRepository<TestEntity>, 'findByStatus', [repository, dataSource], ['active'])
        );

        expect(manager.getRepository).not.toHaveBeenCalled();
        expect(repository.createQueryBuilder).toHaveBeenCalledWith('entity');
    });

    it('requires string arguments for Containing, StartingWith and EndingWith', async () => {
        await execute('findByNameContaining', [1]);

        expect(() => nestedWhereFor(queryBuilder.where.mock.calls[0][0])).toThrow('Containing operator requires a string argument.');
    });

    it('names the parameters of the predicates after True and False by their argument', async () => {
        await execute('findByActiveTrueAndStatus', ['active']);

        const group = nestedWhereFor(queryBuilder.where.mock.calls[0][0]);
        expect(group.where).toHaveBeenCalledWith('entity.active = :queryConst0', { queryConst0: true });
        expect(group.andWhere).toHaveBeenCalledWith('entity.status = :queryArg0', { queryArg0: 'active' });
    });

    it('returns a page with the totals when a findBy method receives a PageRequest', async () => {
        queryBuilder.getManyAndCount.mockResolvedValue([[{ id: 3 }], 21]);

        await expect(execute('findByStatus', ['active', { page: 2, size: 10 }])).resolves.toEqual({
            content: [{ id: 3 }],
            page: 2,
            size: 10,
            totalElements: 21,
            totalPages: 3
        });
        expect(queryBuilder.getMany).not.toHaveBeenCalled();
    });

    describe('deleteBy', () => {
        beforeEach(() => {
            queryBuilder.select = jest.fn().mockReturnThis();
            (repository.metadata as any).primaryColumns = [{ propertyPath: 'id' }];
            (repository as any).getId = jest.fn((entity: { id: number }) => entity.id);
            (repository as any).delete = jest.fn().mockResolvedValue({ affected: 2 });
        });

        it('selects the primary keys of the matching entities and deletes them', async () => {
            queryBuilder.getMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);

            await expect(execute('deleteByStatus', ['archived'])).resolves.toBe(2);

            expect(queryBuilder.select).toHaveBeenCalledWith(['entity.id']);
            expect(repository.delete).toHaveBeenCalledWith([1, 2]);
        });

        it('uses the number of matching entities when the driver does not report the affected rows', async () => {
            queryBuilder.getMany.mockResolvedValue([{ id: 1 }]);
            (repository.delete as jest.Mock).mockResolvedValue({});

            await expect(execute('deleteByStatus', ['archived'])).resolves.toBe(1);
        });

        it('does not run a delete when nothing matches', async () => {
            await expect(execute('deleteByStatus', ['archived'])).resolves.toBe(0);
            expect(repository.delete).not.toHaveBeenCalled();
        });

        it('rejects OrderBy and PageRequest', async () => {
            await expect(execute('deleteByStatusOrderByName', ['archived'])).rejects.toThrow("OrderBy is not supported for 'deleteByStatusOrderByName'.");
            await expect(execute('deleteByStatus', ['archived', { page: 0, size: 1 }])).rejects.toThrow('PageRequest is only supported by findBy methods.');
        });
    });
});
