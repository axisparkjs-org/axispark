import { DataSource, FindManyOptions, ObjectLiteral, RemoveOptions, Repository } from 'typeorm';
import { TransactionContext } from '../transactions/transaction-context';
import { BaseRepository } from './base-repository';

interface TestEntity extends ObjectLiteral {
    id: number;
}

class TestRepository extends BaseRepository<TestEntity> {
    constructor(entityRepository: Repository<TestEntity>, dataSource = {} as DataSource) {
        super(entityRepository, dataSource);
    }

    get manager() {
        return this.entityManager;
    }
}

describe('BaseRepository', () => {
    let repository: TestRepository;
    let entityRepository: any;

    beforeEach(() => {
        entityRepository = {
            save: jest.fn().mockImplementation(async (value) => value),
            find: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
            exists: jest.fn().mockResolvedValue(false),
            remove: jest.fn().mockImplementation(async (value) => value)
        };
        repository = new TestRepository(entityRepository as Repository<TestEntity>);
    });

    it('delegates save for one entity and an array of entities', async () => {
        const entity = { id: 1 };
        const entities = [entity, { id: 2 }];

        await expect(repository.save(entity)).resolves.toBe(entity);
        await expect(repository.save(entities)).resolves.toBe(entities);

        expect(entityRepository.save).toHaveBeenNthCalledWith(1, entity);
        expect(entityRepository.save).toHaveBeenNthCalledWith(2, entities);
    });

    it('passes find options through and returns the matching entities', async () => {
        const options: FindManyOptions<TestEntity> = { take: 5, skip: 10 };
        const entities = [{ id: 1 }];
        entityRepository.find.mockResolvedValue(entities);

        await expect(repository.find(options)).resolves.toBe(entities);
        expect(entityRepository.find).toHaveBeenCalledWith(options);
    });

    it('delegates count and exists with their options', async () => {
        const options: FindManyOptions<TestEntity> = { where: { id: 1 } };
        entityRepository.count.mockResolvedValue(3);
        entityRepository.exists.mockResolvedValue(true);

        await expect(repository.count(options)).resolves.toBe(3);
        await expect(repository.exists(options)).resolves.toBe(true);

        expect(entityRepository.count).toHaveBeenCalledWith(options);
        expect(entityRepository.exists).toHaveBeenCalledWith(options);
    });

    it('removes and returns one entity', async () => {
        const entity = { id: 1 };
        const options: RemoveOptions = { listeners: false };

        await expect(repository.remove(entity, options)).resolves.toBe(entity);
        expect(entityRepository.remove).toHaveBeenCalledWith(entity, options);
    });

    it('removes and returns an array of entities', async () => {
        const entities = [{ id: 1 }, { id: 2 }];

        await expect(repository.remove(entities)).resolves.toBe(entities);
        expect(entityRepository.remove).toHaveBeenCalledWith(entities, undefined);
    });

    describe('inside a transaction', () => {
        const dataSource = { options: { type: 'postgres' }, manager: { name: 'default' } } as unknown as DataSource;
        let transactionalRepository: any;
        let transactionalManager: any;

        beforeEach(() => {
            entityRepository.target = 'TestEntity';
            transactionalRepository = { save: jest.fn().mockImplementation(async (value) => value), find: jest.fn().mockResolvedValue([{ id: 7 }]) };
            transactionalManager = {
                getRepository: jest.fn().mockReturnValue(transactionalRepository),
                getMongoRepository: jest.fn().mockReturnValue(transactionalRepository)
            };
            repository = new TestRepository(entityRepository as Repository<TestEntity>, dataSource);
        });

        it('runs operations on the repository bound to the transaction of its data source', async () => {
            const entity = { id: 1 };

            await TransactionContext.run(dataSource, transactionalManager, async () => {
                await expect(repository.save(entity)).resolves.toBe(entity);
                await expect(repository.find()).resolves.toEqual([{ id: 7 }]);
            });

            expect(transactionalManager.getRepository).toHaveBeenCalledWith('TestEntity');
            expect(transactionalRepository.save).toHaveBeenCalledWith(entity);
            expect(entityRepository.save).not.toHaveBeenCalled();
            expect(entityRepository.find).not.toHaveBeenCalled();
        });

        it('uses a Mongo repository for MongoDB data sources', async () => {
            const mongoDataSource = { options: { type: 'mongodb' } } as unknown as DataSource;
            repository = new TestRepository(entityRepository as Repository<TestEntity>, mongoDataSource);

            await TransactionContext.run(mongoDataSource, transactionalManager, () => repository.find());

            expect(transactionalManager.getMongoRepository).toHaveBeenCalledWith('TestEntity');
        });

        it('ignores transactions of other data sources', async () => {
            await TransactionContext.run({} as DataSource, transactionalManager, () => repository.find());

            expect(entityRepository.find).toHaveBeenCalled();
            expect(transactionalManager.getRepository).not.toHaveBeenCalled();
        });

        it('exposes the transactional entity manager, or the data source manager outside a transaction', async () => {
            expect(repository.manager).toBe(dataSource.manager);
            await TransactionContext.run(dataSource, transactionalManager, async () => expect(repository.manager).toBe(transactionalManager));
        });
    });
});
