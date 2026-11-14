import { DataSource, In, Repository } from 'typeorm';
import { BaseRepository } from './base-repository';

interface Product {
    id: number;
    name: string;
}

class ProductRepository extends BaseRepository<Product> {
    // Public, because the constructor of BaseRepository is protected.
    public constructor(entityRepository: Repository<Product>, dataSource: DataSource = { options: {} } as DataSource) {
        super(entityRepository, dataSource);
    }
}

class FakeObjectId {
    constructor(public readonly value: string) {}
}

describe('BaseRepository primary key and page operations', () => {
    const sqlDataSource = { options: { type: 'postgres' } } as unknown as DataSource;
    const mongoDataSource = { options: { type: 'mongodb' }, driver: { mongodb: { ObjectId: FakeObjectId } } } as unknown as DataSource;
    const primaryColumn = { propertyPath: 'id', databaseName: 'id', createValueMap: (value: unknown) => ({ id: value }) };

    const sqlRepository = (overrides: Record<string, unknown> = {}) => {
        const entityRepository: any = {
            metadata: {
                primaryColumns: [primaryColumn],
                ensureEntityIdMap: (id: unknown) => (typeof id === 'object' ? id : { id })
            },
            findOne: jest.fn().mockResolvedValue(null),
            find: jest.fn().mockResolvedValue([]),
            findAndCount: jest.fn().mockResolvedValue([[], 0]),
            exists: jest.fn().mockResolvedValue(true),
            delete: jest.fn().mockResolvedValue({ affected: 1 }),
            ...overrides
        };
        return { entityRepository, repository: new ProductRepository(entityRepository, sqlDataSource) };
    };

    const mongoRepository = (objectIdColumn: unknown = { databaseName: '_id' }) => {
        const entityRepository: any = {
            metadata: { primaryColumns: [{ databaseName: '_id' }], objectIdColumn },
            findOne: jest.fn().mockResolvedValue({ _id: 'x' }),
            find: jest.fn().mockResolvedValue([]),
            countDocuments: jest.fn().mockResolvedValue(1),
            deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 })
        };
        return { entityRepository, repository: new ProductRepository(entityRepository, mongoDataSource) };
    };

    describe('findPage', () => {
        it('finds one page with the totals', async () => {
            const { entityRepository, repository } = sqlRepository();
            entityRepository.findAndCount.mockResolvedValue([[{ id: 3 }], 5]);

            await expect(repository.findPage({ where: { name: 'a' }, skip: 99 }, { page: 1, size: 2 })).resolves.toEqual({
                content: [{ id: 3 }],
                page: 1,
                size: 2,
                totalElements: 5,
                totalPages: 3
            });
            expect(entityRepository.findAndCount).toHaveBeenCalledWith({ where: { name: 'a' }, skip: 2, take: 2 });
        });

        it('validates the page request', async () => {
            const { repository } = sqlRepository();
            await expect(repository.findPage(undefined, { page: 0, size: 0 })).rejects.toThrow('positive integer size');
        });
    });

    describe('SQL', () => {
        it('finds an entity by its primary key', async () => {
            const { entityRepository, repository } = sqlRepository();

            await expect(repository.findById(1)).resolves.toBeNull();
            expect(entityRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
        });

        it('finds entities by their primary keys', async () => {
            const { entityRepository, repository } = sqlRepository();

            await expect(repository.findByIds([])).resolves.toEqual([]);
            expect(entityRepository.find).not.toHaveBeenCalled();

            await repository.findByIds([1, 2]);
            expect(entityRepository.find).toHaveBeenCalledWith({ where: { id: In([1, 2]) } });
        });

        it('finds entities by composite primary keys', async () => {
            const { entityRepository, repository } = sqlRepository();
            entityRepository.metadata.primaryColumns = [primaryColumn, { propertyPath: 'tenant' }];

            await repository.findByIds([{ id: 1, tenant: 'a' }]);
            expect(entityRepository.find).toHaveBeenCalledWith({ where: [{ id: 1, tenant: 'a' }] });
        });

        it('checks whether an entity exists by its primary key', async () => {
            const { entityRepository, repository } = sqlRepository();

            await expect(repository.existsById(1)).resolves.toBe(true);
            expect(entityRepository.exists).toHaveBeenCalledWith({ where: { id: 1 } });
        });

        it('deletes an entity by its primary key', async () => {
            const { entityRepository, repository } = sqlRepository();

            await expect(repository.deleteById(1)).resolves.toBe(1);
            expect(entityRepository.delete).toHaveBeenCalledWith({ id: 1 });

            entityRepository.delete.mockResolvedValue({});
            await expect(repository.deleteById(2)).resolves.toBe(0);
        });
    });

    describe('MongoDB', () => {
        const hex = '65f1a2b3c4d5e6f708192a3b';

        it('finds a document by its ObjectId, converting the hexadecimal string', async () => {
            const { entityRepository, repository } = mongoRepository();

            await repository.findById(hex);
            expect(entityRepository.findOne).toHaveBeenCalledWith({ where: { _id: new FakeObjectId(hex) } });
        });

        it('keeps the values that are not ObjectId strings', async () => {
            const { entityRepository, repository } = mongoRepository();

            await repository.findById(7);
            await repository.findById('not-an-object-id');
            expect(entityRepository.findOne).toHaveBeenNthCalledWith(1, { where: { _id: 7 } });
            expect(entityRepository.findOne).toHaveBeenNthCalledWith(2, { where: { _id: 'not-an-object-id' } });
        });

        it('does not convert the ids of entities without an ObjectId column', async () => {
            const { entityRepository, repository } = mongoRepository(null);

            await repository.findById(hex);
            expect(entityRepository.findOne).toHaveBeenCalledWith({ where: { _id: hex } });
        });

        it('finds documents by their ids', async () => {
            const { entityRepository, repository } = mongoRepository();

            await repository.findByIds([hex, 1]);
            expect(entityRepository.find).toHaveBeenCalledWith({ where: { _id: { $in: [new FakeObjectId(hex), 1] } } });
        });

        it('checks whether a document exists and deletes it by its id', async () => {
            const { entityRepository, repository } = mongoRepository();

            await expect(repository.existsById(hex)).resolves.toBe(true);
            expect(entityRepository.countDocuments).toHaveBeenCalledWith({ _id: new FakeObjectId(hex) });

            await expect(repository.deleteById(hex)).resolves.toBe(1);
            expect(entityRepository.deleteOne).toHaveBeenCalledWith({ _id: new FakeObjectId(hex) });

            entityRepository.deleteOne.mockResolvedValue({});
            await expect(repository.deleteById(hex)).resolves.toBe(0);
        });

        it('uses _id when the metadata has no column names', async () => {
            const { entityRepository, repository } = mongoRepository(null);
            entityRepository.metadata.primaryColumns = [];

            await repository.findById(1);
            expect(entityRepository.findOne).toHaveBeenCalledWith({ where: { _id: 1 } });
        });
    });
});
