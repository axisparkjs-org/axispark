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
            getCount: jest.fn().mockResolvedValue(0)
        };
        repository = {
            metadata: {
                columns: ['id', 'status', 'email', 'age', 'createdAt', 'name', 'score'].map((propertyName) => ({
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
        expect(queryBuilder.getMany).toHaveBeenCalledTimes(1);
    });

    it.each([
        ['findByScoreLessThan', [10], 'entity.score < :queryArg0', { queryArg0: 10 }],
        ['findByScoreLessThanEqual', [10], 'entity.score <= :queryArg0', { queryArg0: 10 }],
        ['findByScoreGreaterThan', [10], 'entity.score > :queryArg0', { queryArg0: 10 }],
        ['findByScoreGreaterThanEqual', [10], 'entity.score >= :queryArg0', { queryArg0: 10 }],
        ['findByScoreBetween', [5, 10], 'entity.score BETWEEN :queryArg0 AND :queryArg1', { queryArg0: 5, queryArg1: 10 }],
        ['findByScoreIn', [[5, 10]], 'entity.score IN (:...queryArg0)', { queryArg0: [5, 10] }],
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
});
