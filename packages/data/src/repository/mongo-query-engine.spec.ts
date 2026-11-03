import { MongoRepository, ObjectLiteral } from 'typeorm';
import { TransactionContext } from '../transactions/transaction-context';
import { BaseRepository } from './base-repository';
import { MongoQueryEngine } from './mongo-query-engine';
import { PageRequest, QueryMethodParser } from './query-method-parser';

interface TestDocument extends ObjectLiteral {
    id: number;
    status: string;
    email: string;
    age: number;
    name: string;
    score: number;
    createdAt: Date;
}

describe('MongoQueryEngine', () => {
    let engine: MongoQueryEngine;
    let repository: MongoRepository<TestDocument>;

    beforeEach(() => {
        engine = new MongoQueryEngine(new QueryMethodParser());
        repository = {
            metadata: {
                columns: ['id', 'status', 'email', 'age', 'name', 'score', 'createdAt'].map((propertyName) => ({ propertyName, propertyPath: propertyName }))
            },
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn().mockResolvedValue(null),
            countDocuments: jest.fn().mockResolvedValue(0)
        } as unknown as MongoRepository<TestDocument>;
    });

    const execute = (methodName: string, methodArgs: unknown[] = []) =>
        engine.execute({} as BaseRepository<TestDocument>, methodName, [repository], methodArgs);

    it('builds AND filters and uses Mongo pagination and ordering options', async () => {
        const page: PageRequest = { page: 2, size: 10 };
        await execute('findByStatusAndAgeGreaterThanOrderByCreatedAtDescAndNameAsc', ['active', 18, page]);

        expect(repository.find).toHaveBeenCalledWith({
            where: { $and: [{ status: 'active' }, { age: { $gt: 18 } }] },
            order: { createdAt: 'DESC', name: 'ASC' },
            skip: 20,
            take: 10
        });
    });

    it('groups AND predicates within each OR branch', async () => {
        await execute('findByStatusAndAgeGreaterThanOrEmail', ['active', 18, 'a@example.com']);

        expect(repository.find).toHaveBeenCalledWith({
            where: {
                $or: [{ $and: [{ status: 'active' }, { age: { $gt: 18 } }] }, { $and: [{ email: 'a@example.com' }] }]
            }
        });
    });

    it.each([
        ['findByScoreLessThan', [10], { score: { $lt: 10 } }],
        ['findByScoreLessThanEqual', [10], { score: { $lte: 10 } }],
        ['findByScoreGreaterThan', [10], { score: { $gt: 10 } }],
        ['findByScoreGreaterThanEqual', [10], { score: { $gte: 10 } }],
        ['findByScoreBetween', [5, 10], { score: { $gte: 5, $lte: 10 } }],
        ['findByScoreIn', [[5, 10]], { score: { $in: [5, 10] } }],
        ['findByNameLike', ['A_%'], { name: /^A..*$/ }],
        ['findByNameIsNull', [], { name: null }],
        ['findByNameIsNotNull', [], { name: { $ne: null } }]
    ])('supports the derived Mongo operator in %s', async (methodName, args, filter) => {
        await execute(methodName as string, args as unknown[]);
        expect(repository.find).toHaveBeenCalledWith({ where: { $and: [filter] } });
    });

    it('escapes regular expression characters when translating Like patterns', async () => {
        await execute('findByNameLike', ['a+b%']);
        expect(repository.find).toHaveBeenCalledWith({ where: { $and: [{ name: /^a\+b.*$/ }] } });
    });

    it('executes findOneBy, countBy, and existsBy with Mongo repository methods', async () => {
        repository.findOne = jest.fn().mockResolvedValue({ id: 1 });
        repository.countDocuments = jest.fn().mockResolvedValue(2);

        await expect(execute('findOneById', [1])).resolves.toEqual({ id: 1 });
        expect(repository.findOne).toHaveBeenCalledWith({ where: { $and: [{ id: 1 }] } });
        await expect(execute('countByStatus', ['active'])).resolves.toBe(2);
        expect(repository.countDocuments).toHaveBeenCalledWith({ $and: [{ status: 'active' }] });
        await expect(execute('existsByStatus', ['active'])).resolves.toBe(true);
        repository.countDocuments = jest.fn().mockResolvedValue(0);
        await expect(execute('existsByStatus', ['inactive'])).resolves.toBe(false);
    });

    it('rejects Like values that are not strings', async () => {
        await expect(execute('findByNameLike', [10])).rejects.toThrow('Like operator requires a string argument.');
    });

    it('rejects incorrect parameter counts', async () => {
        await expect(execute('findByStatus')).rejects.toThrow('expected 1 argument(s), received 0');
    });

    it('rejects ordering for count and exists operations', async () => {
        await expect(execute('countByStatusOrderByNameAsc', ['active'])).rejects.toThrow('OrderBy is not supported');
    });

    it('defaults an omitted order direction to ascending and accepts a property name fallback', async () => {
        repository.metadata.columns[0] = { propertyName: 'id' } as any;
        await execute('findByIdOrderById', [1]);
        expect(repository.find).toHaveBeenCalledWith({ where: { $and: [{ id: 1 }] }, order: { id: 'ASC' } });
    });

    it('rejects an invalid repository argument', async () => {
        await expect(engine.execute({} as BaseRepository<TestDocument>, 'findById', [], [1])).rejects.toThrow('MongoRepository must be the first');
    });

    it('runs the query on the transactional Mongo repository when a transaction is open on the data source', async () => {
        const dataSource = { options: { type: 'mongodb' } } as any;
        const transactionalRepository = { ...repository, find: jest.fn().mockResolvedValue([{ id: 1 }]) };
        const manager = { getMongoRepository: jest.fn().mockReturnValue(transactionalRepository) } as any;
        (repository as any).target = 'TestDocument';

        const result = await TransactionContext.run(dataSource, manager, () =>
            engine.execute({} as BaseRepository<TestDocument>, 'findByStatus', [repository, dataSource], ['active'])
        );

        expect(result).toEqual([{ id: 1 }]);
        expect(manager.getMongoRepository).toHaveBeenCalledWith('TestDocument');
        expect(repository.find).not.toHaveBeenCalled();
    });
});
